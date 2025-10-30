#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stitch_accelerated.py

完整拼接流水线（集成快速并行 tiled 融合 + multiband tile 内优化）：
- 特征检测 (ORB / 可选 SIFT)
- 特征匹配 + Lowe ratio + RANSAC 单应估计
- SIFT fallback（可选）
- 构建变换图，自动或手动选择参考图，Dijkstra 合成 H_{i->ref}
- 可选线性曝光补偿 (a * I + b)
- 画布计算 -> M_final = T * H_{i->ref}
- 并行 tiled 融合 (distance 或 multiband)
  - multiband：限制每 tile 参与图像数、动态调整金字塔层级
  - 每 tile 仅 warp 该 tile ROI，避免全画布 warp
- 使用线程池并行（避免多进程的巨量内存复制）

用法示例：
  python stitch_accelerated.py --input_dir input_images --out result.png \
    --blend multiband --tile --tile_size 2048 --workers 8 --max_images_per_tile 6 --pyr_levels 4 \
    --sift_fallback --use_sift --exposure_comp

依赖：
  pip install opencv-python numpy tqdm

作者: ChatGPT 自动生成（整合你的需求）
"""
import os
import cv2
import numpy as np
from glob import glob
import argparse
from tqdm import tqdm
import heapq
import json
from math import ceil
from multiprocessing.dummy import Pool as ThreadPool
from functools import partial

# -------------------------
# I/O / 加载图片
# -------------------------
def load_images(input_dir, exts=('jpg','jpeg','png','tif','tiff','bmp')):
    files = []
    for e in exts:
        files += glob(os.path.join(input_dir, f'*.{e}'))
    files = sorted(files)
    if len(files) == 0:
        raise RuntimeError(f'没有在 {input_dir} 发现图片（支持扩展名：{exts}）')
    imgs = []
    for f in files:
        data = np.fromfile(f, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError(f'无法读取图片 {f}')
        imgs.append(img)
    return imgs, files

# -------------------------
# 特征：ORB 与可选 SIFT
# -------------------------
def create_detectors(nfeatures_orb=5000, use_sift=False):
    orb = cv2.ORB_create(nfeatures_orb)
    sift = None
    if use_sift:
        try:
            sift = cv2.SIFT_create()
        except Exception:
            sift = None
    return orb, sift

def detect_and_compute_both(images, orb, sift=None):
    N = len(images)
    kps_orb = [None]*N
    des_orb = [None]*N
    kps_sift = [None]*N
    des_sift = [None]*N
    for idx, img in enumerate(tqdm(images, desc='Detect & Compute')):
        kp_o, des_o = orb.detectAndCompute(img, None)
        kps_orb[idx] = kp_o
        des_orb[idx] = des_o
        if sift is not None:
            kp_s, des_s = sift.detectAndCompute(img, None)
            kps_sift[idx] = kp_s
            des_sift[idx] = des_s
    return {'kps_orb': kps_orb, 'des_orb': des_orb, 'kps_sift': kps_sift, 'des_sift': des_sift}

# -------------------------
# 匹配 + Lowe ratio
# -------------------------
def match_knn(desc1, desc2, use_sift=False):
    if desc1 is None or desc2 is None:
        return []
    if not use_sift:
        bf = cv2.BFMatcher(cv2.NORM_HAMMING)
        matches = bf.knnMatch(desc1, desc2, k=2)
    else:
        FLANN_INDEX_KDTREE = 1
        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
        search_params = dict(checks=50)
        flann = cv2.FlannBasedMatcher(index_params, search_params)
        if desc1.dtype != np.float32:
            desc1 = desc1.astype(np.float32)
        if desc2.dtype != np.float32:
            desc2 = desc2.astype(np.float32)
        matches = flann.knnMatch(desc1, desc2, k=2)
    return matches

def lowe_ratio_filter(knn_matches, ratio=0.75):
    good = []
    for m_n in knn_matches:
        if len(m_n) < 2:
            continue
        m, n = m_n
        if m.distance < ratio * n.distance:
            good.append(m)
    return good

# -------------------------
# pairwise H（先 ORB，失败时可选 SIFT）
# -------------------------
def compute_pairwise_homographies(kps_orb, des_orb, kps_sift, des_sift,
                                  use_sift_fallback=False,
                                  ratio=0.75, ransac_thresh=5.0, min_inliers=20):
    N = len(kps_orb)
    edges = {}
    for i in tqdm(range(N), desc='Pairwise H outer'):
        for j in range(i+1, N):
            knn = match_knn(des_orb[i], des_orb[j], use_sift=False)
            good = lowe_ratio_filter(knn, ratio=ratio)
            method = 'ORB'
            if len(good) < min_inliers and use_sift_fallback and (des_sift[i] is not None and des_sift[j] is not None):
                knn2 = match_knn(des_sift[i], des_sift[j], use_sift=True)
                good2 = lowe_ratio_filter(knn2, ratio=ratio)
                if len(good2) >= min_inliers:
                    good = good2
                    method = 'SIFT'
            if len(good) < min_inliers:
                continue
            if method == 'ORB':
                src_pts = np.float32([kps_orb[i][m.queryIdx].pt for m in good]).reshape(-1,1,2)
                dst_pts = np.float32([kps_orb[j][m.trainIdx].pt for m in good]).reshape(-1,1,2)
            else:
                src_pts = np.float32([kps_sift[i][m.queryIdx].pt for m in good]).reshape(-1,1,2)
                dst_pts = np.float32([kps_sift[j][m.trainIdx].pt for m in good]).reshape(-1,1,2)
            H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, ransac_thresh)
            if H is None or mask is None:
                continue
            inliers = int(mask.sum())
            if inliers < min_inliers:
                continue
            edges[(i,j)] = {'H': H, 'inliers': inliers, 'matches': good, 'mask': mask, 'method': method}
            try:
                Hinv = np.linalg.inv(H)
                edges[(j,i)] = {'H': Hinv, 'inliers': inliers, 'matches': good, 'mask': mask, 'method': method}
            except np.linalg.LinAlgError:
                pass
    return edges

# -------------------------
# 图、选择参考、Dijkstra 合成 H_{i->ref}
# -------------------------
def build_adjacency(edges, N):
    adj = [[] for _ in range(N)]
    for (i,j), info in edges.items():
        adj[i].append((j, info['inliers']))
    degrees = [len(set([v for v,_ in adj[i]])) for i in range(N)]
    return adj, degrees

def choose_reference(edges, N):
    score = [0]*N
    for (i,j), info in edges.items():
        score[i] += info['inliers']
    ref = int(np.argmax(score))
    return ref, score

def dijkstra_paths(edges, N, ref_idx):
    adj_rev = [[] for _ in range(N)]
    for (u,v), info in edges.items():
        inl = max(1, int(info['inliers']))
        cost = 1.0 / float(inl)
        adj_rev[v].append((u, cost))
    dist = [float('inf')]*N
    prev = [None]*N
    dist[ref_idx] = 0.0
    heap = [(0.0, ref_idx)]
    while heap:
        d,u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v,c in adj_rev[u]:
            nd = d + c
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(heap, (nd, v))
    H_to_ref = {}
    for src in range(N):
        if src == ref_idx:
            H_to_ref[src] = np.eye(3, dtype=np.float64)
            continue
        if prev[src] is None:
            continue
        path = []
        cur = src
        while cur is not None:
            path.append(cur)
            if cur == ref_idx:
                break
            cur = prev[cur]
        if path[-1] != ref_idx:
            continue
        H = np.eye(3, dtype=np.float64)
        ok = True
        for k in range(len(path)-1):
            u = path[k]; v = path[k+1]
            if (u,v) not in edges:
                ok = False; break
            H = edges[(u,v)]['H'].dot(H)
        if ok:
            H_to_ref[src] = H
    return H_to_ref, dist, prev

# -------------------------
# 画布边界与 M_final
# -------------------------
def warp_corners(shape, H):
    h,w = shape[:2]
    corners = np.array([[0,0],[w,0],[w,h],[0,h]], dtype=np.float32).reshape(-1,1,2)
    tc = cv2.perspectiveTransform(corners, H)
    return tc.reshape(-1,2)

def compute_canvas_and_transforms(images, H_to_ref):
    pts = []
    for i, img in enumerate(images):
        if i not in H_to_ref:
            continue
        warped = warp_corners(img.shape, H_to_ref[i])
        pts.append(warped)
    if len(pts) == 0:
        raise RuntimeError('没有图像连到参考，无法计算画布')
    all_pts = np.vstack(pts)
    x_min = float(np.min(all_pts[:,0])); y_min = float(np.min(all_pts[:,1]))
    x_max = float(np.max(all_pts[:,0])); y_max = float(np.max(all_pts[:,1]))
    canvas_w = int(ceil(x_max - x_min))
    canvas_h = int(ceil(y_max - y_min))
    T = np.array([[1,0,-x_min],[0,1,-y_min],[0,0,1]], dtype=np.float64)
    M_final = {}
    for i in range(len(images)):
        if i in H_to_ref:
            M_final[i] = T.dot(H_to_ref[i])
    return (canvas_w, canvas_h, M_final, (x_min, y_min, x_max, y_max))

# -------------------------
# 曝光补偿（线性 a*I + b）
# -------------------------
def compute_luminance(img):
    img_f = img.astype(np.float32)
    lum = 0.299*img_f[:,:,2] + 0.587*img_f[:,:,1] + 0.114*img_f[:,:,0]
    return lum

def exposure_compensate_images(images, H_to_ref, ref_idx, max_samples=20000,
                               a_bounds=(0.6,1.6), b_bounds=(-50,50)):
    corrected = [img.copy() for img in images]
    ref_img = images[ref_idx]
    ref_h, ref_w = ref_img.shape[:2]
    ref_lum = compute_luminance(ref_img)
    ref_mask = np.ones((ref_h, ref_w), dtype=np.uint8)*255
    for i in tqdm(range(len(images)), desc='Exposure comp'):
        if i == ref_idx or i not in H_to_ref: continue
        H_i_ref = H_to_ref[i]
        warped_i = cv2.warpPerspective(images[i], H_i_ref, (ref_w, ref_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
        warped_mask = cv2.warpPerspective(np.ones(images[i].shape[:2], dtype=np.uint8)*255, H_i_ref, (ref_w, ref_h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        overlap = (warped_mask>0) & (ref_mask>0)
        pts_idx = np.where(overlap)
        count = pts_idx[0].shape[0]
        if count < 500: continue
        if count > max_samples:
            sel = np.random.choice(count, max_samples, replace=False)
            r = pts_idx[0][sel]; c = pts_idx[1][sel]
        else:
            r = pts_idx[0]; c = pts_idx[1]
        src_vals = compute_luminance(warped_i)[r,c].astype(np.float32)
        dst_vals = ref_lum[r,c].astype(np.float32)
        A = np.vstack([src_vals, np.ones_like(src_vals)]).T
        try:
            sol, *_ = np.linalg.lstsq(A, dst_vals, rcond=None)
            a_est, b_est = float(sol[0]), float(sol[1])
        except Exception:
            continue
        a_clamped = float(np.clip(a_est, a_bounds[0], a_bounds[1]))
        b_clamped = float(np.clip(b_est, b_bounds[0], b_bounds[1]))
        img = images[i].astype(np.float32)
        img_corr = img * a_clamped + b_clamped
        img_corr = np.clip(img_corr, 0, 255).astype(np.uint8)
        corrected[i] = img_corr
    return corrected

# -------------------------
# 融合：tile 内快速 warp & blend (distance or multiband with optimizations)
# -------------------------
def intersects(a_minx, a_miny, a_maxx, a_maxy, b_minx, b_miny, b_maxx, b_maxy):
    return not (a_maxx <= b_minx or a_minx >= b_maxx or a_maxy <= b_miny or a_miny >= b_maxy)

def warp_patch_for_tile(img, M_final_i, tile_bbox):
    x0,y0,x1,y1 = tile_bbox
    w_tile = x1 - x0; h_tile = y1 - y0
    T = np.array([[1,0,-x0],[0,1,-y0],[0,0,1]], dtype=np.float64)
    H_tile = T.dot(M_final_i)
    warped = cv2.warpPerspective(img, H_tile, (w_tile, h_tile), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    mask = np.ones(img.shape[:2], dtype=np.uint8)*255
    warped_mask = cv2.warpPerspective(mask, H_tile, (w_tile, h_tile), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return warped, warped_mask

def multiband_blend_images(warped_imgs_list, warped_masks_list, levels=3):
    H = warped_imgs_list[0].shape[0]; W = warped_imgs_list[0].shape[1]
    K = len(warped_imgs_list)
    weights = []
    for m in warped_masks_list:
        if m.sum()==0:
            weights.append(np.zeros((H,W), dtype=np.float32))
            continue
        dist = cv2.distanceTransform((m>0).astype(np.uint8)*255, cv2.DIST_L2, 5)
        if dist.max()>0: dist = dist / dist.max()
        weights.append(dist.astype(np.float32)+1e-6)
    weights = np.stack(weights, axis=-1)
    s = np.sum(weights, axis=2, keepdims=True); s[s==0]=1.0
    weights = weights / s
    # build laplacians
    lp_img = [build_laplacian_pyramid((warped_imgs_list[k]).astype(np.float32), levels) for k in range(K)]
    gp_weight = []
    for k in range(K):
        gw = [weights[:,:,k]]
        for l in range(levels):
            gw.append(cv2.pyrDown(gw[-1]))
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

def build_laplacian_pyramid(img, levels):
    gp = [img.astype(np.float32)]
    for i in range(levels):
        gp.append(cv2.pyrDown(gp[-1]))
    lp = []
    for i in range(levels):
        GE = cv2.pyrUp(gp[i+1])
        if GE.shape[:2] != gp[i].shape[:2]:
            GE = cv2.resize(GE, (gp[i].shape[1], gp[i].shape[0]), interpolation=cv2.INTER_LINEAR)
        L = gp[i] - GE
        lp.append(L)
    lp.append(gp[-1])
    return lp

def reconstruct_from_laplacian(lp):
    levels = len(lp)-1
    img = lp[-1]
    for i in range(levels-1, -1, -1):
        up = cv2.pyrUp(img)
        if up.shape[:2] != lp[i].shape[:2]:
            up = cv2.resize(up, (lp[i].shape[1], lp[i].shape[0]), interpolation=cv2.INTER_LINEAR)
        img = up + lp[i]
    return img

# process single tile (function for threads)
def process_tile_worker(tile, images_dict, M_final, image_bboxes, canvas_size,
                        blend_method='distance', pyr_levels=3, max_images_per_tile=6):
    tx,ty,x0,y0,x1,y1 = tile
    w_tile = x1 - x0; h_tile = y1 - y0
    tile_bbox = (x0,y0,x1,y1)
    # collect candidate images that intersect this tile
    candidates = []
    for idx, bbox in image_bboxes.items():
        minx, miny, maxx, maxy = bbox
        if intersects(minx, miny, maxx, maxy, x0,y0,x1,y1):
            # overlap area approx:
            ox = max(0, min(maxx,x1) - max(minx,x0))
            oy = max(0, min(maxy,y1) - max(miny,y0))
            area = ox*oy
            if area>0:
                candidates.append((idx, area))
    if len(candidates) == 0:
        return (tx,ty, np.ones((h_tile, w_tile, 3), dtype=np.uint8)*255)
    # sort by overlap area desc
    candidates.sort(key=lambda x: x[1], reverse=True)
    # limit number of images per tile (important for multiband)
    if len(candidates) > max_images_per_tile:
        candidates = candidates[:max_images_per_tile]
    warped_imgs = []
    warped_masks = []
    for idx, area in candidates:
        img = images_dict[idx]
        M = M_final[idx]
        warped, warped_mask = warp_patch_for_tile(img, M, tile_bbox)
        if warped_mask.sum() == 0:
            continue
        warped_imgs.append(warped.astype(np.float32))
        warped_masks.append(warped_mask)
    if len(warped_imgs) == 0:
        return (tx,ty, np.ones((h_tile, w_tile, 3), dtype=np.uint8)*255)
    if blend_method == 'distance' or len(warped_imgs) == 1:
        num = np.zeros((h_tile,w_tile,3), dtype=np.float32)
        den = np.zeros((h_tile,w_tile,1), dtype=np.float32)
        for wi, wm in zip(warped_imgs, warped_masks):
            dist = cv2.distanceTransform((wm>0).astype(np.uint8)*255, cv2.DIST_L2, 5)
            if dist.max()>0: dist = dist / dist.max()
            dist3 = np.repeat(dist[:,:,np.newaxis], 3, axis=2).astype(np.float32)
            num += wi * dist3
            den += dist3[:,:,:1] * (wm[:,:,np.newaxis].astype(np.float32)/255.0)
        den_safe = den.copy(); den_safe[den_safe==0] = 1.0
        sub_res = (num / den_safe).astype(np.uint8)
        empty = (den[:,:,0]==0)
        sub_res[empty] = 255
        return (tx,ty, sub_res)
    else:
        # multiband: adapt pyramid levels by number of images
        K = len(warped_imgs)
        # simple heuristic: reduce levels when many images or tile small
        levels = min(pyr_levels, max(1, int(pyr_levels - np.log2(max(1,K)/2))))
        levels = max(1, levels)
        tile_res = multiband_blend_images(warped_imgs, warped_masks, levels=levels)
        return (tx,ty, tile_res)

# assemble canvas from tile results
def assemble_tiles_to_canvas(tile_results, canvas_w, canvas_h, tile_size):
    out = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8)*255
    for tx,ty,patch in tile_results:
        x0 = tx * tile_size; y0 = ty * tile_size
        h_tile, w_tile = patch.shape[:2]
        out[y0:y0+h_tile, x0:x0+w_tile] = patch
    return out

# top-level tiled blending orchestrator (uses thread pool)
def tiled_blend_parallel(images, M_final, canvas_size, out_path, tile_size=2048, workers=8,
                         blend_method='distance', pyr_levels=3, max_images_per_tile=6):
    canvas_w, canvas_h = canvas_size
    # precompute image bboxes in canvas coords
    image_bboxes = {}
    for idx, img in images.items():
        M = M_final.get(idx)
        if M is None:
            continue
        h,w = img.shape[:2]
        corners = np.array([[0,0,1],[w,0,1],[w,h,1],[0,h,1]], dtype=np.float64).T
        tc = M.dot(corners)
        tc = tc / tc[2,:]
        xs = tc[0,:]; ys = tc[1,:]
        minx, maxx = xs.min(), xs.max()
        miny, maxy = ys.min(), ys.max()
        image_bboxes[idx] = (minx, miny, maxx, maxy)
    # build tile list
    htiles = ceil(canvas_h / tile_size)
    wtiles = ceil(canvas_w / tile_size)
    tiles = []
    for ty in range(htiles):
        for tx in range(wtiles):
            x0 = tx*tile_size; y0 = ty*tile_size
            x1 = min(canvas_w, x0+tile_size); y1 = min(canvas_h, y0+tile_size)
            tiles.append((tx,ty,x0,y0,x1,y1))
    print(f'canvas {canvas_w}x{canvas_h}, tiles={len(tiles)}, workers={workers}')
    # prepare worker partial
    worker = partial(process_tile_worker,
                     images_dict=images, M_final=M_final, image_bboxes=image_bboxes,
                     canvas_size=(canvas_w, canvas_h),
                     blend_method=blend_method, pyr_levels=pyr_levels, max_images_per_tile=max_images_per_tile)
    # use ThreadPool to avoid heavy image pickling overhead
    workers = max(1, workers)
    pool = ThreadPool(workers)
    results = []
    try:
        for res in tqdm(pool.imap_unordered(worker, tiles), total=len(tiles), desc='Blending tiles'):
            results.append(res)
    finally:
        pool.close(); pool.join()
    # assemble
    out = assemble_tiles_to_canvas(results, canvas_w, canvas_h, tile_size)
    cv2.imencode('.png', out)[1].tofile(out_path)
    return out

# -------------------------
# 保存 homographies / diagnostics helper
# -------------------------
def save_homographies(H_to_ref, filenames, out_npz):
    keys = sorted(H_to_ref.keys())
    indices = np.array(keys, dtype=np.int32)
    mats = np.stack([H_to_ref[k] for k in keys], axis=0)
    names = [filenames[k] for k in keys]
    np.savez_compressed(out_npz, indices=indices, mats=mats, names=np.array(names))
    print(f'保存 {len(keys)} 个 H 到 {out_npz}')

# optional match drawing for diagnostics
def draw_and_save_matches(img1, img2, kps1, kps2, matches, mask, out_file, max_draw=80):
    inliers = []
    if mask is not None:
        mask1d = mask.ravel().tolist()
        for idx, m in enumerate(matches):
            if idx < len(mask1d) and mask1d[idx]:
                inliers.append(m)
    else:
        inliers = matches
    sel = inliers[:max_draw]
    if len(sel) == 0:
        return
    vis = cv2.drawMatches(img1, kps1, img2, kps2, sel, None, flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS)
    dirname = os.path.dirname(out_file)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname, exist_ok=True)
    cv2.imencode('.png', vis)[1].tofile(out_file)

# -------------------------
# 主流程
# -------------------------
def main(args):
    images_list, filenames = load_images(args.input_dir)
    N = len(images_list)
    print(f'加载 {N} 张图片')

    orb, sift = create_detectors(nfeatures_orb=args.nfeatures, use_sift=args.use_sift)
    descs = detect_and_compute_both(images_list, orb, sift)
    kps_orb = descs['kps_orb']; des_orb = descs['des_orb']
    kps_sift = descs['kps_sift']; des_sift = descs['des_sift']

    print('计算两两单应（先 ORB，必要时尝试 SIFT）...')
    edges = compute_pairwise_homographies(kps_orb, des_orb, kps_sift, des_sift,
                                         use_sift_fallback=args.sift_fallback,
                                         ratio=args.ratio, ransac_thresh=args.ransac_thresh, min_inliers=args.min_matches)
    print(f'找到 {len(edges)//2} 对可靠单应')

    adj, degrees = build_adjacency(edges, N)
    for i, deg in enumerate(degrees):
        print(f'图像 {i} ({os.path.basename(filenames[i])}) 连接数: {deg}')

    if args.ref_index is None:
        ref_idx, scores = choose_reference(edges, N)
        print(f'自动选择参考图像 index={ref_idx} ({os.path.basename(filenames[ref_idx])})')
    else:
        ref_idx = args.ref_index
        print(f'手动指定参考图像 index={ref_idx} ({os.path.basename(filenames[ref_idx])})')

    H_to_ref, dist, prev = dijkstra_paths(edges, N, ref_idx)
    print(f'计算到参考图的全局单应，连通数量: {len(H_to_ref)}/{N}')

    save_homographies(H_to_ref, filenames, args.hom_out)

    # optionally save matches visualizations
    if args.save_matches:
        os.makedirs(args.matches_dir, exist_ok=True)
        saved = 0
        for (i,j), info in edges.items():
            if i >= j: continue
            matches = info['matches']; mask = info.get('mask', None)
            method = info.get('method','ORB')
            if method == 'SIFT' and kps_sift[j] is not None:
                draw_and_save_matches(images_list[i], images_list[j], kps_sift[i], kps_sift[j], matches, mask, os.path.join(args.matches_dir, f'matches_{i:03d}_{j:03d}.png'), max_draw=args.max_match_draw)
            else:
                draw_and_save_matches(images_list[i], images_list[j], kps_orb[i], kps_orb[j], matches, mask, os.path.join(args.matches_dir, f'matches_{i:03d}_{j:03d}.png'), max_draw=args.max_match_draw)
            saved += 1
        print(f'已保存匹配可视化到 {args.matches_dir}, count={saved}')

    # exposure compensation optionally
    images_for_warp = images_list
    if args.exposure_comp:
        print('执行曝光补偿...')
        corrected = exposure_compensate_images(images_list, H_to_ref, ref_idx, max_samples=20000,
                                               a_bounds=(args.comp_a_min, args.comp_a_max),
                                               b_bounds=(args.comp_b_min, args.comp_b_max))
        images_for_warp = corrected
        print('曝光补偿完成')

    # compute canvas & transforms
    canvas_w, canvas_h, M_final, bbox = compute_canvas_and_transforms(images_for_warp, H_to_ref)
    print(f'画布大小: {canvas_w} x {canvas_h}, bbox={bbox}')
    if canvas_w <= 0 or canvas_h <= 0:
        raise RuntimeError('计算到的画布无效（可能没有连通图像）')

    # convert images_for_warp into dict indexed by original indices for quick access
    images_dict = {i: images_for_warp[i] for i in range(len(images_for_warp))}

    # write graph diagnostics
    graph = {}
    for (u,v), info in edges.items():
        graph.setdefault(str(u), []).append({'to': int(v), 'inliers': int(info['inliers']), 'method': info.get('method','ORB')})
    json_path = os.path.splitext(args.out)[0] + '_graph.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({'files': filenames, 'graph': graph, 'ref_index': int(ref_idx)}, f, ensure_ascii=False, indent=2)
    print('图结构已写入', json_path)

    # blending
    print('开始融合（tile 并行）...')
    if args.tile:
        tiled_blend_parallel(images_dict, M_final, (canvas_w, canvas_h), args.out,
                             tile_size=args.tile_size, workers=args.workers,
                             blend_method=args.blend, pyr_levels=args.pyr_levels,
                             max_images_per_tile=args.max_images_per_tile)
    else:
        # fallback: non-tiled (原方式) - 可能很慢
        if args.blend == 'distance':
            # very memory-heavy if canvas big
            print('警告：非 tiled + distance 模式可能非常慢/耗内存')
            # naive warp-as-full approach
            num = np.zeros((canvas_h, canvas_w, 3), dtype=np.float32)
            den = np.zeros((canvas_h, canvas_w, 1), dtype=np.float32)
            for i, img in images_dict.items():
                if i not in M_final: continue
                M = M_final[i]
                warped = cv2.warpPerspective(img, M, (canvas_w, canvas_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0)).astype(np.float32)
                mask = np.ones(img.shape[:2], dtype=np.uint8)*255
                warped_mask = cv2.warpPerspective(mask, M, (canvas_w, canvas_h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
                warped_mask_bin = (warped_mask>0).astype(np.uint8)*255
                if warped_mask_bin.sum()==0: continue
                dist = cv2.distanceTransform(warped_mask_bin, cv2.DIST_L2, 5)
                if dist.max()>0: dist = dist / dist.max()
                dist3 = np.repeat(dist[:,:,np.newaxis], 3, axis=2).astype(np.float32)
                num += warped * dist3
                den += dist3[:,:,:1] * (warped_mask_bin[:,:,np.newaxis].astype(np.float32)/255.0)
            den_safe = den.copy(); den_safe[den_safe==0] = 1.0
            res = (num / den_safe).astype(np.uint8)
            empty = (den[:,:,0]==0); res[empty]=255
            cv2.imencode('.png', res)[1].tofile(args.out)
        else:
            # multiband non-tiled - memory heavy
            warped_imgs = []; warped_masks = []
            for i, img in images_dict.items():
                if i not in M_final: continue
                M = M_final[i]
                warped = cv2.warpPerspective(img, M, (canvas_w, canvas_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
                mask = np.ones(img.shape[:2], dtype=np.uint8)*255
                warped_mask = cv2.warpPerspective(mask, M, (canvas_w, canvas_h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
                if warped_mask.sum()==0: continue
                warped_imgs.append(warped.astype(np.float32)); warped_masks.append(warped_mask)
            if len(warped_imgs)==0:
                raise RuntimeError('没有可融合的图像')
            if len(warped_imgs)==1:
                cv2.imencode('.png', warped_imgs[0].astype(np.uint8))[1].tofile(args.out)
            else:
                res = multiband_blend_images(warped_imgs, warped_masks, levels=args.pyr_levels)
                cv2.imencode('.png', res)[1].tofile(args.out)

    print('完成，结果保存到', args.out)

# -------------------------
# CLI 参数
# -------------------------
if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--input_dir', required=True, help='输入图片文件夹')
    p.add_argument('--out', default='result.png', help='输出拼接图')
    p.add_argument('--hom_out', default='homographies.npz', help='输出 homographies npz')
    p.add_argument('--method', choices=['ORB','SIFT'], default='ORB', help='首选特征算法 (ORB 或 SIFT)')
    p.add_argument('--nfeatures', type=int, default=5000, help='ORB nfeatures')
    p.add_argument('--ratio', type=float, default=0.75, help='Lowe ratio')
    p.add_argument('--ransac_thresh', type=float, default=5.0, help='RANSAC reproj threshold (px)')
    p.add_argument('--min_matches', type=int, default=20, help='最小 inliers 阈值用于接收 pairwise H')
    p.add_argument('--ref_index', type=int, default=None, help='手动指定参考图索引')
    p.add_argument('--blend', choices=['distance','multiband'], default='distance', help='融合方法')
    p.add_argument('--pyr_levels', type=int, default=4, help='拉普拉斯金字塔层数（multiband 模式上限）')
    p.add_argument('--tile', action='store_true', help='使用 tiled 流式处理（推荐用于大画布）')
    p.add_argument('--tile_size', type=int, default=2048, help='tile 大小（像素）')
    p.add_argument('--workers', type=int, default=max(1, os.cpu_count()-1), help='线程池大小（并行 tile 数）')
    p.add_argument('--max_images_per_tile', type=int, default=6, help='每 tile 最大参与融合的图像数（multiband 优化）')
    p.add_argument('--save_matches', action='store_true', help='保存两两匹配可视化')
    p.add_argument('--matches_dir', default='matches', help='匹配可视化保存目录')
    p.add_argument('--max_match_draw', type=int, default=80, help='每对匹配可视化绘制上限')
    p.add_argument('--sift_fallback', action='store_true', help='当 ORB 匹配不足时尝试使用 SIFT（如果可用）')
    p.add_argument('--use_sift', action='store_true', help='一开始就同时计算 SIFT 特征（若 OpenCV 支持）')
    p.add_argument('--exposure_comp', action='store_true', help='启用曝光/亮度补偿（线性 a*I + b）')
    p.add_argument('--comp_a_min', type=float, default=0.6, help='曝光补偿 a 下界')
    p.add_argument('--comp_a_max', type=float, default=1.6, help='曝光补偿 a 上界')
    p.add_argument('--comp_b_min', type=float, default=-50.0, help='曝光补偿 b 下界')
    p.add_argument('--comp_b_max', type=float, default=50.0, help='曝光补偿 b 上界')
    args = p.parse_args()

    # ensure SIFT flags consistent
    if args.method == 'SIFT' and not args.use_sift:
        args.use_sift = True
        args.sift_fallback = True

    main(args)
