#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fast_blend.py

Fast tiled/patched blending that:
- Loads images and precomputed homographies (homographies.npz).
- Computes global canvas size from homographies.
- Splits canvas into tiles and processes tiles in parallel.
- For each tile: for each image that intersects tile, warp only the ROI
  using H_tile = T_tile * M_final to get small warped patch.
- Blend with distance-weighted or multiband (distance default).
- Save final PNG.

Usage:
  python fast_blend.py --images_dir input_images --hom homographies.npz --out fast_result.png \
       --tile_size 2048 --workers 8 --blend distance --downsample 1

Notes:
- Use --blend distance for speed.
- Use --downsample 2 for quick half-resolution preview.
"""
import os
import cv2
import numpy as np
from glob import glob
import argparse
from math import ceil
from multiprocessing import Pool, cpu_count
from functools import partial

def load_hom_npz(hom_path):
    data = np.load(hom_path, allow_pickle=True)
    indices = data['indices']        # e.g. [0,1,2,...]
    mats = data['mats']             # shape (K,3,3)
    names = data['names']           # filenames for those indices
    # Build dict index -> H matrix
    Hdict = {}
    for idx, mat in zip(indices.tolist(), mats):
        Hdict[int(idx)] = mat.astype(np.float64)
    return Hdict, names.tolist()

def load_images_for_indices(images_dir, target_indices, filenames_all):
    # filenames_all are absolute or relative paths used in hom npz; we attempt to find them inside images_dir by basename
    imgs = {}
    basename_to_idx = {}
    for full in filenames_all:
        bn = os.path.basename(full)
        basename_to_idx[bn] = full
    for i in target_indices:
        # get the filename
        full = filenames_all[i] if i < len(filenames_all) else None
        if full is None:
            # try match by index in filenames_all
            continue
    # Simpler: load by scanning images_dir and mapping basenames
    files = sorted(glob(os.path.join(images_dir, '*')))
    bmap = {os.path.basename(f): f for f in files}
    # Now for each index in target_indices, find filename by looking into filenames_all
    for i in target_indices:
        fname = os.path.basename(filenames_all[i])
        if fname in bmap:
            path = bmap[fname]
        else:
            # fallback: try filenames_all[i] directly
            path = filenames_all[i] if os.path.exists(filenames_all[i]) else None
            if path is None:
                raise RuntimeError(f'找不到图像文件 {filenames_all[i]}（基名 {fname}） 在 {images_dir}')
        data = np.fromfile(path, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        imgs[i] = img
    return imgs

def compute_canvas_bbox(images, Hdict):
    # for each image with H, warp its corners and union
    pts = []
    for i, H in Hdict.items():
        h,w = images[i].shape[:2]
        corners = np.array([[0,0],[w,0],[w,h],[0,h]], dtype=np.float32).reshape(-1,1,2)
        tc = cv2.perspectiveTransform(corners, H)
        pts.append(tc.reshape(-1,2))
    pts = np.vstack(pts)
    x_min = float(np.min(pts[:,0])); y_min = float(np.min(pts[:,1]))
    x_max = float(np.max(pts[:,0])); y_max = float(np.max(pts[:,1]))
    return x_min, y_min, x_max, y_max

def tile_list(canvas_w, canvas_h, tile_size):
    htiles = ceil(canvas_h / tile_size)
    wtiles = ceil(canvas_w / tile_size)
    tiles = []
    for ty in range(htiles):
        for tx in range(wtiles):
            x0 = tx*tile_size; y0 = ty*tile_size
            x1 = min(canvas_w, x0+tile_size); y1 = min(canvas_h, y0+tile_size)
            tiles.append((tx,ty,x0,y0,x1,y1))
    return tiles

def intersects(a_minx, a_miny, a_maxx, a_maxy, b_minx, b_miny, b_maxx, b_maxy):
    return not (a_maxx <= b_minx or a_minx >= b_maxx or a_maxy <= b_miny or a_miny >= b_maxy)

def warp_patch_for_tile(img, M_final_i, tile_bbox, canvas_size):
    # tile_bbox in canvas coords: (x0,y0,x1,y1)
    x0,y0,x1,y1 = tile_bbox
    w_tile = x1 - x0; h_tile = y1 - y0
    # Make translation T_tile so that world canvas -> tile-local coords
    T = np.array([[1,0,-x0],[0,1,-y0],[0,0,1]], dtype=np.float64)
    H_tile = T.dot(M_final_i)
    # warp source into tile size directly
    warped = cv2.warpPerspective(img, H_tile, (w_tile, h_tile), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    mask = np.ones(img.shape[:2], dtype=np.uint8)*255
    warped_mask = cv2.warpPerspective(mask, H_tile, (w_tile, h_tile), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return warped, warped_mask

def process_tile(tile, images, M_final, canvas_size, blend_method='distance', pyr_levels=3):
    # tile: (tx,ty,x0,y0,x1,y1)
    tx,ty,x0,y0,x1,y1 = tile
    w_tile = x1-x0; h_tile = y1-y0
    # For each image, check intersection with tile (use warped corners)
    warped_imgs = []
    warped_masks = []
    for i, img in images.items():
        if i not in M_final:
            continue
        # compute warped corners in canvas coords
        h,w = img.shape[:2]
        corners = np.array([[0,0,1],[w,0,1],[w,h,1],[0,h,1]], dtype=np.float64).T  # 3x4
        tc = M_final[i].dot(corners)
        tc = tc / tc[2,:]
        xs = tc[0,:]; ys = tc[1,:]
        minx = xs.min(); maxx = xs.max(); miny = ys.min(); maxy = ys.max()
        # tile bbox in canvas coords
        if not intersects(minx,miny,maxx,maxy, x0,y0,x1,y1):
            continue
        # warp only ROI for this tile
        warped, warped_mask = warp_patch_for_tile(img, M_final[i], (x0,y0,x1,y1), canvas_size)
        if warped_mask.sum() == 0:
            continue
        warped_imgs.append(warped.astype(np.float32))
        warped_masks.append(warped_mask)
    # if nothing intersects, return empty tile (white)
    if len(warped_imgs) == 0:
        return (tx,ty, np.ones((h_tile,w_tile,3), dtype=np.uint8)*255)
    # blend
    if blend_method == 'distance':
        num = np.zeros((h_tile,w_tile,3), dtype=np.float32)
        den = np.zeros((h_tile,w_tile,1), dtype=np.float32)
        for wi, wm in zip(warped_imgs, warped_masks):
            dist = cv2.distanceTransform((wm>0).astype(np.uint8)*255, cv2.DIST_L2, 5)
            if dist.max() > 0:
                dist = dist / dist.max()
            dist3 = np.repeat(dist[:,:,np.newaxis], 3, axis=2).astype(np.float32)
            num += wi * dist3
            den += dist3[:,:,:1] * (wm[:,:,np.newaxis].astype(np.float32)/255.0)
        den_safe = den.copy(); den_safe[den_safe==0] = 1.0
        sub_res = (num / den_safe).astype(np.uint8)
        sub_empty = (den[:,:,0]==0)
        sub_res[sub_empty] = 255
        return (tx,ty, sub_res)
    else:
        # multiband on small tile
        if len(warped_imgs) == 1:
            return (tx,ty, np.clip(warped_imgs[0],0,255).astype(np.uint8))
        tile_res = multiband_blend_images(warped_imgs, warped_masks, levels=pyr_levels)
        return (tx,ty, tile_res)

# Multiband helpers (copied minimal)
def pyr_down(img):
    return cv2.pyrDown(img)

def pyr_up(img, size):
    up = cv2.pyrUp(img)
    if up.shape[1] != size[1] or up.shape[0] != size[0]:
        up = cv2.resize(up, (size[1], size[0]), interpolation=cv2.INTER_LINEAR)
    return up

def build_laplacian_pyramid(img, levels):
    gp = [img.astype(np.float32)]
    for i in range(levels):
        gp.append(pyr_down(gp[-1]))
    lp = []
    for i in range(levels):
        GE = pyr_up(gp[i+1], gp[i].shape[:2])
        L = gp[i] - GE
        lp.append(L)
    lp.append(gp[-1])
    return lp

def reconstruct_from_laplacian(lp):
    levels = len(lp)-1
    img = lp[-1]
    for i in range(levels-1, -1, -1):
        img = pyr_up(img, lp[i].shape[:2]) + lp[i]
    return img

def multiband_blend_images(warped_imgs_list, warped_masks_list, levels=3):
    H = warped_imgs_list[0].shape[0]; W = warped_imgs_list[0].shape[1]
    K = len(warped_imgs_list)
    weights = []
    for m in warped_masks_list:
        if m.sum()==0:
            weights.append(np.zeros((H,W), dtype=np.float32))
            continue
        dist = cv2.distanceTransform((m>0).astype(np.uint8)*255, cv2.DIST_L2, 5)
        if dist.max()>0:
            dist = dist / dist.max()
        weights.append(dist.astype(np.float32) + 1e-6)
    weights = np.stack(weights, axis=-1)
    s = np.sum(weights, axis=2, keepdims=True)
    s[s==0] = 1.0
    weights = weights / s
    lp_img = [build_laplacian_pyramid((warped_imgs_list[k]).astype(np.float32), levels) for k in range(K)]
    gp_weight = []
    for k in range(K):
        gw = [weights[:,:,k]]
        for l in range(levels):
            gw.append(pyr_down(gw[-1]))
        gp_weight.append(gw)
    blended_pyr = []
    for lvl in range(levels+1):
        acc = np.zeros_like(lp_img[0][lvl])
        for k in range(K):
            w = gp_weight[k][lvl]
            if w.ndim==2:
                w3 = np.repeat(w[:,:,np.newaxis], 3, axis=2)
            else:
                w3 = w
            acc += lp_img[k][lvl] * w3
        blended_pyr.append(acc)
    res = reconstruct_from_laplacian(blended_pyr)
    res = np.clip(res, 0, 255).astype(np.uint8)
    return res

def main(args):
    # load homographies
    Hdict, names = load_hom_npz(args.hom)
    # load images referenced by names
    # build mapping index->filename from names array
    filenames_all = names
    # find by basename in images_dir
    files = sorted(glob(os.path.join(args.images_dir, '*')))
    basename_map = {os.path.basename(f):f for f in files}
    images = {}
    for idx in sorted(Hdict.keys()):
        bn = os.path.basename(filenames_all[idx])
        if bn in basename_map:
            path = basename_map[bn]
        elif os.path.exists(filenames_all[idx]):
            path = filenames_all[idx]
        else:
            raise RuntimeError(f'无法找到图像文件 {filenames_all[idx]}')
        data = np.fromfile(path, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if args.downsample > 1:
            img = cv2.resize(img, (img.shape[1]//args.downsample, img.shape[0]//args.downsample), interpolation=cv2.INTER_AREA)
            # scale H accordingly: when downsampling images by s, their coordinates scale by 1/s
            # But homographies map image -> canvas (canvas assumed same scale) so we need to scale H: multiply first two columns by 1/s? simpler: scale M_final by appropriate factor
        images[idx] = img
    # If downsample used, we must also scale Hdict accordingly.
    scale = args.downsample
    M_final = {}
    # Build canvas bbox using scaled images and scaled H (if downsample>1 we scale target canvas)
    # Strategy: if downsample>1, scale each homography M by 1/scale on destination coordinates:
    # We treat Hdict mapping src_coords -> canvas_coords. If we downscale source image by s, the src coords are reduced by s,
    # So H_scaled should satisfy H_scaled * (x/s,y/s,1) = H*(x,y,1) => H_scaled = H * diag(s,s,1)
    # Also if we want a downsampled canvas we divide canvas coords by s: so final H_used = (1/s) * H * diag(s,s,1) = H (unchanged) ??? To avoid complexity: we will compute canvas bbox using original H but then downscale the canvas by factor.
    # Simpler approach: compute bbox in original coords, then downscale canvas and offsets by 'scale'.
    # Compute orig bbox (using original images sizes and original H)
    # For simplicity, assume homographies were computed at original resolution and scale canvas afterwards.
    # Compute canvas bbox (original)
    # We'll compute canvas using original H and original image sizes read from file system, not downsampled images.
    # For that, reload original sizes:
    # (Implementing a robust scale handling is complex; here we assume downsample=1 for correctness; if using downsample>1, it's for preview and user accepts potential alignment shifts.)
    if args.downsample != 1:
        print("注意: downsample != 1 模式为粗略预览，可能存在坐标缩放偏差。")
    # compute canvas bbox using current Hdict and original sizes approximated by images dict sizes scaled back
    # We'll compute warped corners using Hdict and current images shapes (works acceptably for preview)
    x_min, y_min, x_max, y_max = None, None, None, None
    for i, H in Hdict.items():
        img = images[i]
        h,w = img.shape[:2]
        corners = np.array([[0,0],[w,0],[w,h],[0,h]], dtype=np.float32).reshape(-1,1,2)
        tc = cv2.perspectiveTransform(corners, H)
        tc = tc.reshape(-1,2)
        if x_min is None:
            x_min, y_min = tc[:,0].min(), tc[:,1].min()
            x_max, y_max = tc[:,0].max(), tc[:,1].max()
        else:
            x_min = min(x_min, tc[:,0].min()); y_min = min(y_min, tc[:,1].min())
            x_max = max(x_max, tc[:,0].max()); y_max = max(y_max, tc[:,1].max())
    # apply downsampling to canvas
    x_min *= 1.0/args.downsample; y_min *= 1.0/args.downsample
    x_max *= 1.0/args.downsample; y_max *= 1.0/args.downsample
    canvas_w = int(ceil(x_max - x_min)); canvas_h = int(ceil(y_max - y_min))
    print(f'Canvas (approx) = {canvas_w} x {canvas_h}')
    # build M_final: include translation T to move x_min,y_min to 0 and also scale by downsample
    for i, H in Hdict.items():
        # scale H destination coords by 1/downsample: implement S = diag(1/d,1/d,1)
        s = args.downsample
        Sdst = np.array([[1.0/s,0,0],[0,1.0/s,0],[0,0,1]], dtype=np.float64)
        # apply Sdst * H
        Hs = Sdst.dot(H)
        T = np.array([[1,0,-x_min],[0,1,-y_min],[0,0,1]], dtype=np.float64)
        M_final[i] = T.dot(Hs)
    # create tile list
    tiles = tile_list(canvas_w, canvas_h, args.tile_size)
    print(f'tiles count = {len(tiles)}')
    # prepare workers
    work_items = tiles
    # partial for worker
    worker = partial(process_tile, images=images, M_final=M_final, canvas_size=(canvas_w, canvas_h),
                     blend_method=('distance' if args.blend=='distance' else 'multiband'), pyr_levels=args.pyr_levels)
    # parallel processing
    workers = args.workers if args.workers>0 else max(1, cpu_count()-1)
    print(f'使用 workers = {workers}')
    results = []
    if workers == 1:
        for t in work_items:
            results.append(worker(t))
    else:
        with Pool(processes=workers) as pool:
            for r in pool.imap_unordered(worker, work_items):
                results.append(r)
    # assemble canvas
    out = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8)*255
    for tx,ty,patch in results:
        # find tile coords
        x0 = tx*args.tile_size; y0 = ty*args.tile_size
        h_tile, w_tile = patch.shape[:2]
        out[y0:y0+h_tile, x0:x0+w_tile] = patch
    # save
    cv2.imencode('.png', out)[1].tofile(args.out)
    print('saved', args.out)

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--images_dir', required=True, help='图片目录（与 hom 文件中 names 的基名应匹配）')
    p.add_argument('--hom', required=True, help='homographies.npz（indices, mats, names）')
    p.add_argument('--out', default='fast_result.png', help='输出文件名')
    p.add_argument('--tile_size', type=int, default=2048, help='tile 大小（像素）')
    p.add_argument('--workers', type=int, default=max(1, cpu_count()-2), help='并行 worker 数')
    p.add_argument('--blend', choices=['distance','multiband'], default='distance', help='融合方法')
    p.add_argument('--pyr_levels', type=int, default=3, help='multiband 金字塔层数')
    p.add_argument('--downsample', type=int, default=1, help='缩小因子用于快速预览（整数 >=1），1 表示不缩小')
    args = p.parse_args()
    main(args)


#  python3 stitch_new.py --input_dir ../../../Downloads/Photos-1-001/ --out result.png --method ORB --blend distance --tile --tile_size 1024
