from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import numpy as np
import cv2
import io
from PIL import Image
import base64
import uvicorn
from typing import List

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境中应该限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 在文件顶部添加这个函数
def stitch_two_images(img1, img2):
    """手动拼接两张图像，针对古画类图像优化，处理部分重叠的情况"""
    # 转换为灰度图
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    # 增强对比度以提取更多特征
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray1 = clahe.apply(gray1)
    gray2 = clahe.apply(gray2)

    # # 检查图像尺寸，判断可能的拼接方向
    # h1, w1 = img1.shape[:2]
    # h2, w2 = img2.shape[:2]

    # # 如果宽度相近，可能是垂直拼接；如果高度相近，可能是水平拼接
    # vertical_stitch = abs(w1 - w2) < min(w1, w2) * 0.2
    # horizontal_stitch = abs(h1 - h2) < min(h1, h2) * 0.2

    # print(f"可能的拼接方向: {'垂直' if vertical_stitch else ''}{'水平' if horizontal_stitch else ''}{'未确定' if not vertical_stitch and not horizontal_stitch else ''}")
    print("尝试通过特征匹配确定拼接关系")

    # 尝试多种特征检测器
    detectors = []
    try:
        # SIFT通常对纹理和细节最敏感
        detectors.append(("SIFT", cv2.SIFT_create(nfeatures=10000, contrastThreshold=0.01)))
    except:
        pass

    try:
        # SURF也很适合
        detectors.append(("SURF", cv2.xfeatures2d.SURF_create(hessianThreshold=50)))
    except:
        pass

    # ORB作为备选
    detectors.append(("ORB", cv2.ORB_create(nfeatures=10000, scaleFactor=1.1, edgeThreshold=15)))

    best_matches = []
    best_detector_name = ""
    best_kp1 = []
    best_kp2 = []

    # 尝试每种检测器
    for detector_name, detector in detectors:
        try:
            # 检测关键点和描述符
            kp1, des1 = detector.detectAndCompute(gray1, None)
            kp2, des2 = detector.detectAndCompute(gray2, None)

            print(f"{detector_name} - 图像1特征点: {len(kp1)}, 图像2特征点: {len(kp2)}")

            if len(kp1) < 10 or len(kp2) < 10:
                continue

            # 根据检测器类型选择匹配器
            if detector_name in ["SIFT", "SURF"]:
                FLANN_INDEX_KDTREE = 1
                index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
                search_params = dict(checks=50)
                matcher = cv2.FlannBasedMatcher(index_params, search_params)
            else:
                # ORB 使用汉明距离
                matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

            # 对于古画，使用knnMatch可能更好
            matches = matcher.knnMatch(des1, des2, k=2)

            # 应用比率测试筛选好的匹配
            good_matches = []
            for m, n in matches:
                # 对于部分重叠的图像，使用更宽松的阈值
                if m.distance < 0.85 * n.distance:
                    good_matches.append(m)

            print(f"{detector_name} - 找到 {len(good_matches)} 个好的匹配点")

            # 保存最佳结果
            if len(good_matches) > len(best_matches):
                best_matches = good_matches
                best_detector_name = detector_name
                best_kp1 = kp1
                best_kp2 = kp2
        except Exception as e:
            print(f"{detector_name} 检测失败: {str(e)}")

    # 如果没有找到足够的匹配点
    if len(best_matches) < 10:
        print("尝试旋转图像后再匹配")
        rotation_angles = [90, 180, 270]  # 尝试不同的旋转角度

        for angle in rotation_angles:
            print(f"尝试旋转 {angle} 度")
            # 旋转第二张图像
            h2, w2 = img2.shape[:2]
            center = (w2 // 2, h2 // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated_img2 = cv2.warpAffine(img2, rotation_matrix, (w2, h2))

            # 对旋转后的图像进行特征匹配
            rotated_gray2 = cv2.cvtColor(rotated_img2, cv2.COLOR_BGR2GRAY)
            rotated_gray2 = clahe.apply(rotated_gray2)

            for detector_name, detector in detectors:
                try:
                    kp1, des1 = detector.detectAndCompute(gray1, None)
                    kp2, des2 = detector.detectAndCompute(rotated_gray2, None)

                    if len(kp1) < 10 or len(kp2) < 10:
                        continue

                    # 根据检测器类型选择匹配器
                    if detector_name in ["SIFT", "SURF"]:
                        FLANN_INDEX_KDTREE = 1
                        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
                        search_params = dict(checks=50)
                        matcher = cv2.FlannBasedMatcher(index_params, search_params)
                    else:
                        matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

                    matches = matcher.knnMatch(des1, des2, k=2)

                    good_matches = []
                    for m, n in matches:
                        if m.distance < 0.85 * n.distance:
                            good_matches.append(m)

                    print(f"{detector_name} - 旋转 {angle} 度 - 找到 {len(good_matches)} 个好的匹配点")

                    if len(good_matches) > len(best_matches):
                        best_matches = good_matches
                        best_detector_name = detector_name
                        best_kp1 = kp1
                        best_kp2 = kp2
                        img2 = rotated_img2  # 使用旋转后的图像
                        print(f"使用旋转 {angle} 度后的图像")
                except Exception as e:
                    print(f"{detector_name} 旋转匹配失败: {str(e)}")

    # 如果仍然没有找到足够的匹配点，返回None
    if len(best_matches) < 10:
        print(f"匹配点不足({len(best_matches)}个)，无法拼接")
        return None

    print(f"使用 {best_detector_name} 检测器，找到 {len(best_matches)} 个好的匹配点")

    # 提取匹配点的坐标
    src_pts = np.float32([best_kp1[m.queryIdx].pt for m in best_matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([best_kp2[m.trainIdx].pt for m in best_matches]).reshape(-1, 1, 2)

    # 计算单应性矩阵，使用RANSAC方法过滤异常值
    H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

    # 计算单应性矩阵，使用RANSAC方法过滤异常值
    H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

    # 检查单应性矩阵是否合理
    if H is None or not is_homography_valid(H):
        print("单应性矩阵无效，无法拼接")
        return None

    # 创建拼接结果
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]

    # 计算变换后的图像尺寸
    pts = np.float32([[0, 0], [0, h2-1], [w2-1, h2-1], [w2-1, 0]]).reshape(-1, 1, 2)
    dst = cv2.perspectiveTransform(pts, H)

    # 计算最终图像的尺寸
    min_x = min(0, dst[0][0][0], dst[1][0][0], dst[2][0][0], dst[3][0][0])
    max_x = max(w1, dst[0][0][0], dst[1][0][0], dst[2][0][0], dst[3][0][0])
    min_y = min(0, dst[0][0][1], dst[1][0][1], dst[2][0][1], dst[3][0][1])
    max_y = max(h1, dst[0][0][1], dst[1][0][1], dst[2][0][1], dst[3][0][1])

    # 调整变换矩阵以适应新的尺寸
    H_adj = np.eye(3, dtype=np.float32)
    H_adj[0, 2] = -min_x
    H_adj[1, 2] = -min_y
    H_final = H_adj.dot(H)

    # 创建最终图像
    panorama_width = int(max_x - min_x)
    panorama_height = int(max_y - min_y)
    panorama = np.zeros((panorama_height, panorama_width, 3), dtype=np.uint8)

    # 将第一张图像复制到结果中
    panorama[-int(min_y):h1-int(min_y), -int(min_x):w1-int(min_x)] = img1

    # 应用透视变换将第二张图像拼接到结果中
    cv2.warpPerspective(img2, H_final, (panorama_width, panorama_height), panorama, borderMode=cv2.BORDER_TRANSPARENT)

    # 增强拼接边缘的平滑过渡
    try:
        # 创建掩码，标识第一张图像的区域
        mask1 = np.zeros((panorama_height, panorama_width), dtype=np.uint8)
        mask1[-int(min_y):h1-int(min_y), -int(min_x):w1-int(min_x)] = 255

        # 创建第二张图像的掩码
        mask2 = np.zeros((panorama_height, panorama_width), dtype=np.uint8)
        cv2.warpPerspective(np.ones((h2, w2), dtype=np.uint8) * 255,
                           H_final, (panorama_width, panorama_height),
                           mask2, borderMode=cv2.BORDER_TRANSPARENT)

        # 找到重叠区域
        overlap = cv2.bitwise_and(mask1, mask2)

        # 在重叠区域应用渐变混合
        # 计算距离变换
        dist1 = cv2.distanceTransform(mask1, cv2.DIST_L2, 3)
        dist2 = cv2.distanceTransform(mask2, cv2.DIST_L2, 3)

        # 在重叠区域创建权重
        overlap_pixels = np.where(overlap > 0)
        for y, x in zip(overlap_pixels[0], overlap_pixels[1]):
            weight1 = dist2[y, x] / (dist1[y, x] + dist2[y, x] + 1e-6)
            weight2 = 1 - weight1
            panorama[y, x] = weight1 * panorama[y, x] + weight2 * panorama[y, x]
    except Exception as e:
        print(f"边缘混合失败: {str(e)}")

    return panorama

def is_homography_valid(H):
    """检查单应性矩阵是否合理"""
    # 检查矩阵是否包含NaN或无穷大
    if np.isnan(H).any() or np.isinf(H).any():
        return False

    # 检查矩阵行列式是否接近于0（奇异矩阵）
    det = np.linalg.det(H)
    if abs(det) < 1e-6:
        return False

    # 检查变换是否过于极端
    # 提取缩放和旋转部分
    scale_x = np.sqrt(H[0, 0]**2 + H[0, 1]**2)
    scale_y = np.sqrt(H[1, 0]**2 + H[1, 1]**2)

    # 如果缩放因子过大或过小，可能是不合理的变换
    if scale_x > 5 or scale_x < 0.2 or scale_y > 5 or scale_y < 0.2:
        return False

    return True


@app.post("/stitch")
async def stitch_images(files: List[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要两张图片")

    try:
        # 读取所有图像
        images = []
        original_sizes = []

        for file in files:
            contents = await file.read()
            image = np.array(Image.open(io.BytesIO(contents)))
            original_sizes.append((image.shape[1], image.shape[0]))  # 记录原始尺寸 (宽, 高)

            # 确保图像是 BGR 格式 (OpenCV 使用 BGR)
            if len(image.shape) == 3 and image.shape[2] == 4:  # RGBA
                image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
            elif len(image.shape) == 3 and image.shape[2] == 3:  # RGB
                image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            # 对于古画类图像，增强对比度和锐度以提取更多特征
            # 创建CLAHE对象（对比度受限的自适应直方图均衡化）
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

            # 分离通道，对每个通道应用CLAHE
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            l = clahe.apply(l)
            enhanced_lab = cv2.merge((l, a, b))
            enhanced_image = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

            # 应用锐化滤镜
            kernel = np.array([[-1, -1, -1],
                               [-1,  9, -1],
                               [-1, -1, -1]])
            sharpened = cv2.filter2D(enhanced_image, -1, kernel)

            # 增加图像尺寸限制，提高质量
            max_dimension = 12800
            h, w = image.shape[:2]
            if h > max_dimension or w > max_dimension:
                if w > h:
                    new_w = max_dimension
                    new_h = int(h * (max_dimension / w))
                else:
                    new_h = max_dimension
                    new_w = int(w * (max_dimension / h))
                image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)  # 使用更高质量的插值方法

            images.append(image)

        # 保存原始图像用于调试
        original_images = images.copy()

        # 实现基于基准图像的拼接策略
        if len(images) > 2:
            print("使用基准图像拼接策略")

            # 选择第一张图像作为基准图像
            base_image = images[0]
            remaining_images = images[1:]
            used_indices = [0]  # 记录已使用的图像索引

            # 循环直到所有图像都被拼接或无法继续拼接
            while len(used_indices) < len(images):
                best_match_index = -1
                best_match_result = None

                # 尝试找到能与当前基准图像拼接的最佳图像
                for i, img in enumerate(remaining_images):
                    if i + 1 in used_indices:  # +1 是因为remaining_images从images[1]开始
                        continue

                    # 尝试拼接
                    result = stitch_two_images(base_image, img)
                    if result is not None:
                        best_match_index = i
                        best_match_result = result
                        break  # 找到第一个可以拼接的就使用

                # 如果找不到可拼接的图像，尝试反向拼接
                if best_match_result is None:
                    for i, img in enumerate(remaining_images):
                        if i + 1 in used_indices:
                            continue

                        result = stitch_two_images(img, base_image)
                        if result is not None:
                            best_match_index = i
                            best_match_result = result
                            break

                # 如果仍然找不到可拼接的图像，尝试旋转后拼接
                if best_match_result is None:
                    for i, img in enumerate(remaining_images):
                        if i + 1 in used_indices:
                            continue

                        # 尝试不同角度的旋转
                        for angle in [90, 180, 270]:
                            h, w = img.shape[:2]
                            center = (w // 2, h // 2)
                            rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                            rotated_img = cv2.warpAffine(img, rotation_matrix, (w, h))

                            result = stitch_two_images(base_image, rotated_img)
                            if result is not None:
                                best_match_index = i
                                best_match_result = result
                                remaining_images[i] = rotated_img  # 更新为旋转后的图像
                                print(f"使用旋转 {angle} 度后的图像 {i+1}")
                                break

                            # 尝试反向拼接
                            result = stitch_two_images(rotated_img, base_image)
                            if result is not None:
                                best_match_index = i
                                best_match_result = result
                                remaining_images[i] = rotated_img  # 更新为旋转后的图像
                                print(f"使用旋转 {angle} 度后的图像 {i+1} (反向拼接)")
                                break

                        if best_match_result is not None:
                            break

                # 如果找到了可拼接的图像
                if best_match_index != -1 and best_match_result is not None:
                    base_image = best_match_result  # 更新基准图像
                    used_indices.append(best_match_index + 1)  # 记录已使用的索引
                    print(f"成功拼接图像 {best_match_index + 1}")
                else:
                    # 如果无法找到可拼接的图像，尝试使用另一张图像作为基准
                    unused_indices = [i for i in range(len(images)) if i not in used_indices]
                    if unused_indices:
                        new_base_index = unused_indices[0]
                        base_image = images[new_base_index]
                        used_indices.append(new_base_index)
                        print(f"无法继续拼接，使用图像 {new_base_index} 作为新的基准")
                    else:
                        print("所有图像都已尝试，但无法完全拼接")
                        break

            # 如果成功拼接了所有图像
            if len(used_indices) == len(images):
                panorama = base_image
                status = cv2.Stitcher_OK
                print("基准图像拼接策略成功")
            else:
                # 如果无法完全拼接，回退到标准拼接方法
                print("基准图像拼接策略部分成功，回退到标准拼接")
                stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
                status, panorama = stitcher.stitch(images)
        else:
            # 对于只有两张图像的情况，直接尝试拼接
            result = stitch_two_images(images[0], images[1])
            if result is not None:
                panorama = result
                status = cv2.Stitcher_OK
                print("两张图像拼接成功")
            else:
                # 尝试反向拼接
                result = stitch_two_images(images[1], images[0])
                if result is not None:
                    panorama = result
                    status = cv2.Stitcher_OK
                    print("两张图像反向拼接成功")
                else:
                    # 尝试旋转后拼接
                    for angle in [90, 180, 270]:
                        h, w = images[1].shape[:2]
                        center = (w // 2, h // 2)
                        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                        rotated_img = cv2.warpAffine(images[1], rotation_matrix, (w, h))

                        result = stitch_two_images(images[0], rotated_img)
                        if result is not None:
                            panorama = result
                            status = cv2.Stitcher_OK
                            print(f"旋转 {angle} 度后拼接成功")
                            break

                        # 尝试反向拼接
                        result = stitch_two_images(rotated_img, images[0])
                        if result is not None:
                            panorama = result
                            status = cv2.Stitcher_OK
                            print(f"旋转 {angle} 度后反向拼接成功")
                            break
                    else:
                        # 回退到标准拼接
                        stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
                        status, panorama = stitcher.stitch(images)

        if status != cv2.Stitcher_OK:
            # 如果全景模式失败，尝试扫描模式
            stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
            try:
                stitcher.setPanoConfidenceThresh(0.1)
            except:
                pass
            status, panorama = stitcher.stitch(images)

            # 如果两种模式都失败，尝试更激进的预处理
            if status != cv2.Stitcher_OK:
                print("尝试更激进的预处理方法")
                try:
                    # 应用更强的对比度增强
                    processed_images = []
                    for img in original_images:
                        # 转换为灰度图增强特征
                        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                        # 应用自适应阈值
                        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                      cv2.THRESH_BINARY, 11, 2)
                        # 转回彩色以便拼接
                        thresh_color = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
                        processed_images.append(thresh_color)

                    # 尝试拼接处理后的图像
                    stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
                    status, panorama = stitcher.stitch(processed_images)

                    if status != cv2.Stitcher_OK:
                        stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
                        status, panorama = stitcher.stitch(processed_images)
                except Exception as e:
                    print(f"预处理方法失败: {str(e)}")

            if status != cv2.Stitcher_OK:
                error_messages = {
                    cv2.Stitcher_ERR_NEED_MORE_IMGS: "需要更多图像",
                    cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "单应性估计失败",
                    cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "相机参数调整失败"
                }
                error_msg = error_messages.get(status, f"拼接失败，错误代码: {status}")
                raise HTTPException(status_code=400, detail=error_msg)

        # 将结果转换为 RGB
        panorama_rgb = cv2.cvtColor(panorama, cv2.COLOR_BGR2RGB)

        # 计算原始图像的平均尺寸
        avg_width = sum(w for w, h in original_sizes) / len(original_sizes)
        avg_height = sum(h for w, h in original_sizes) / len(original_sizes)

        # 如果拼接结果太小，进行放大
        pano_h, pano_w = panorama_rgb.shape[:2]
        if pano_w < avg_width * 1.5 or pano_h < avg_height * 1.5:
            scale_factor = max(avg_width * 1.5 / pano_w, avg_height * 1.5 / pano_h)
            new_width = int(pano_w * scale_factor)
            new_height = int(pano_h * scale_factor)
            panorama_rgb = cv2.resize(panorama_rgb, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)

        # 应用后处理以改善拼接结果
        try:
            # 增强对比度
            lab = cv2.cvtColor(panorama_rgb, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced_lab = cv2.merge((cl, a, b))
            panorama_rgb = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)

            # 轻微锐化以增强细节
            kernel = np.array([[0, -1, 0],
                              [-1, 5, -1],
                              [0, -1, 0]])
            panorama_rgb = cv2.filter2D(panorama_rgb, -1, kernel)

            # 去除拼接边缘的黑边
            # 转换为灰度图
            gray = cv2.cvtColor(panorama_rgb, cv2.COLOR_RGB2GRAY)
            # 二值化找到非黑色区域
            _, thresh = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
            # 找到所有轮廓
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                # 找到最大轮廓（主要内容区域）
                max_contour = max(contours, key=cv2.contourArea)
                # 创建掩码
                mask = np.zeros_like(thresh)
                cv2.drawContours(mask, [max_contour], 0, 255, -1)
                # 扩大掩码区域，避免裁剪过紧
                kernel = np.ones((5, 5), np.uint8)
                mask = cv2.dilate(mask, kernel, iterations=2)
                # 获取边界框
                x, y, w, h = cv2.boundingRect(max_contour)
                # 裁剪图像
                panorama_rgb = panorama_rgb[y:y+h, x:x+w]

            # 对于古画，可能需要轻微的降噪处理
            panorama_rgb = cv2.fastNlMeansDenoisingColored(panorama_rgb, None, 3, 3, 7, 21)

        except Exception as e:
            print(f"后处理失败: {str(e)}")

        # 将结果转换为 base64 编码的图像，使用高质量设置
        img = Image.fromarray(panorama_rgb)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", quality=100, optimize=True)  # 使用最高质量设置
        img_str = base64.b64encode(buffer.getvalue()).decode()

        # 返回图像尺寸信息
        return {
            "status": "success",
            "image": img_str,
            "dimensions": {
                "width": panorama_rgb.shape[1],
                "height": panorama_rgb.shape[0]
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"拼接过程中出错: {str(e)}")


@app.post("/stitch-sequential")
async def stitch_sequential_images(files: List[UploadFile] = File(...)):
    """
    按顺序拼接图像，适用于长卷轴类型的古画
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要两张图片")

    try:
        # 读取所有图像
        images = []
        for file in files:
            contents = await file.read()
            image = np.array(Image.open(io.BytesIO(contents)))

            # 确保图像是 BGR 格式 (OpenCV 使用 BGR)
            if len(image.shape) == 3 and image.shape[2] == 4:  # RGBA
                image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
            elif len(image.shape) == 3 and image.shape[2] == 3:  # RGB
                image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

            # 限制图像尺寸，避免内存溢出
            max_dimension = 3000
            h, w = image.shape[:2]
            if h > max_dimension or w > max_dimension:
                if w > h:
                    new_w = max_dimension
                    new_h = int(h * (max_dimension / w))
                else:
                    new_h = max_dimension
                    new_w = int(w * (max_dimension / h))
                image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
                print(f"调整图像尺寸为: {new_w}x{new_h}")

            images.append(image)

        print(f"成功加载 {len(images)} 张图像")

        # 确定拼接方向（水平或垂直）
        # 对于长卷轴，通常是垂直拼接
        h1, w1 = images[0].shape[:2]
        h2, w2 = images[1].shape[:2]

        # 如果宽度相近，可能是垂直拼接
        vertical_stitch = abs(w1 - w2) < min(w1, w2) * 0.2
        print(f"拼接方向: {'垂直' if vertical_stitch else '水平'}")

        # 初始化结果为第一张图像
        result = images[0].copy()

        for i in range(1, len(images)):
            print(f"正在处理第 {i+1}/{len(images)} 张图像")
            current_img = images[i].copy()
            h1, w1 = result.shape[:2]
            h2, w2 = current_img.shape[:2]

            # 使用特征匹配找到重叠区域
            try:
                print("尝试使用特征匹配")
                # 转换为灰度图
                result_gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
                current_gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)

                # 增强对比度以提取更多特征
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                result_gray = clahe.apply(result_gray)
                current_gray = clahe.apply(current_gray)

                # 尝试使用 SIFT
                detector = cv2.SIFT_create(nfeatures=5000)
                kp1, des1 = detector.detectAndCompute(result_gray, None)
                kp2, des2 = detector.detectAndCompute(current_gray, None)

                print(f"特征点数量: 图像1={len(kp1)}, 图像2={len(kp2)}")

                if len(kp1) >= 10 and len(kp2) >= 10:
                    # FLANN 匹配
                    FLANN_INDEX_KDTREE = 1
                    index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
                    search_params = dict(checks=50)
                    flann = cv2.FlannBasedMatcher(index_params, search_params)
                    matches = flann.knnMatch(des1, des2, k=2)

                    # 应用比率测试
                    good_matches = []
                    for m, n in matches:
                        if m.distance < 0.7 * n.distance:
                            good_matches.append(m)

                    print(f"找到 {len(good_matches)} 个好的匹配点")

                    if len(good_matches) >= 4:
                        # 获取匹配点坐标
                        src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                        # 计算变换矩阵
                        M, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)

                        if M is not None:
                            # 应用变换
                            h, w = result.shape[:2]
                            h2, w2 = current_img.shape[:2]

                            # 计算变换后的图像尺寸
                            pts = np.float32([[0, 0], [0, h2-1], [w2-1, h2-1], [w2-1, 0]]).reshape(-1, 1, 2)
                            dst = cv2.perspectiveTransform(pts, M)

                            # 计算新图像的尺寸
                            min_x = min(0, dst[0][0][0], dst[1][0][0], dst[2][0][0], dst[3][0][0])
                            max_x = max(w, dst[0][0][0], dst[1][0][0], dst[2][0][0], dst[3][0][0])
                            min_y = min(0, dst[0][0][1], dst[1][0][1], dst[2][0][1], dst[3][0][1])
                            max_y = max(h, dst[0][0][1], dst[1][0][1], dst[2][0][1], dst[3][0][1])

                            # 调整变换矩阵
                            M_adj = np.eye(3, dtype=np.float32)
                            M_adj[0, 2] = -min_x
                            M_adj[1, 2] = -min_y
                            M_final = M_adj.dot(M)

                            # 创建新图像
                            new_width = int(max_x - min_x)
                            new_height = int(max_y - min_y)
                            new_result = np.zeros((new_height, new_width, 3), dtype=np.uint8)

                            # 复制第一张图像
                            new_result[-int(min_y):h-int(min_y), -int(min_x):w-int(min_x)] = result

                            # 应用透视变换
                            cv2.warpPerspective(current_img, M_final, (new_width, new_height),
                                              new_result, borderMode=cv2.BORDER_TRANSPARENT)

                            result = new_result
                            print("特征匹配成功")
                            continue
            except Exception as e:
                print(f"特征匹配失败: {str(e)}")

            # 如果特征匹配失败，回退到简单拼接
            print("使用简单拼接方法")
            if vertical_stitch:
                # 垂直拼接
                # 调整宽度使两张图像相同
                if w1 != w2:
                    scale = w1 / w2
                    h2_new = int(h2 * scale)
                    current_img = cv2.resize(current_img, (w1, h2_new))
                    h2 = h2_new  # 更新高度
                    print(f"调整第二张图像尺寸为: {w1}x{h2_new}")

                # 寻找最佳重叠区域
                overlap_height = min(h1 // 4, h2 // 4)  # 使用图像高度的1/4作为重叠区域
                overlap_height = max(10, overlap_height)  # 确保至少有10像素的重叠

                print(f"重叠区域高度: {overlap_height}")

                # 计算重叠区域的相似度
                best_y = h1 - overlap_height  # 默认值
                best_diff = float('inf')

                for y in range(max(1, h1 - overlap_height), h1):
                    # 计算重叠区域
                    img1_region = result[y:h1, :]
                    img2_region = current_img[:h1-y, :]

                    # 确保区域大小相同
                    min_h = min(img1_region.shape[0], img2_region.shape[0])
                    if min_h < 10:  # 太小的重叠区域不考虑
                        continue

                    img1_region = img1_region[:min_h, :]
                    img2_region = img2_region[:min_h, :]

                    # 计算差异
                    diff = np.sum(np.abs(img1_region.astype(np.float32) - img2_region.astype(np.float32)))
                    diff = diff / (min_h * w1 * 3)  # 归一化

                    if diff < best_diff:
                        best_diff = diff
                        best_y = y

                print(f"最佳重叠位置: y={best_y}, 差异值={best_diff}")

                # 创建新图像
                new_height = best_y + h2
                new_result = np.zeros((new_height, w1, 3), dtype=np.uint8)

                # 复制第一张图像
                new_result[:h1, :] = result

                # 创建渐变混合区域
                blend_height = h1 - best_y
                for i in range(blend_height):
                    alpha = i / blend_height
                    new_result[best_y + i, :] = (1 - alpha) * result[best_y + i, :] + alpha * current_img[i, :]

                # 复制第二张图像的剩余部分
                new_result[h1:, :] = current_img[blend_height:, :]

                result = new_result
            else:
                # 水平拼接
                # 调整高度使两张图像相同
                if h1 != h2:
                    scale = h1 / h2
                    w2_new = int(w2 * scale)
                    current_img = cv2.resize(current_img, (w2_new, h1))
                    w2 = w2_new  # 更新宽度
                    print(f"调整第二张图像尺寸为: {w2_new}x{h1}")

                # 寻找最佳重叠区域
                overlap_width = min(w1 // 4, w2 // 4)  # 使用图像宽度的1/4作为重叠区域
                overlap_width = max(10, overlap_width)  # 确保至少有10像素的重叠

                print(f"重叠区域宽度: {overlap_width}")

                # 计算重叠区域的相似度
                best_x = w1 - overlap_width  # 默认值
                best_diff = float('inf')

                for x in range(max(1, w1 - overlap_width), w1):
                    # 计算重叠区域
                    img1_region = result[:, x:w1]
                    img2_region = current_img[:, :w1-x]

                    # 确保区域大小相同
                    min_w = min(img1_region.shape[1], img2_region.shape[1])
                    if min_w < 10:  # 太小的重叠区域不考虑
                        continue

                    img1_region = img1_region[:, :min_w]
                    img2_region = img2_region[:, :min_w]

                    # 计算差异
                    diff = np.sum(np.abs(img1_region.astype(np.float32) - img2_region.astype(np.float32)))
                    diff = diff / (h1 * min_w * 3)  # 归一化

                    if diff < best_diff:
                        best_diff = diff
                        best_x = x

                print(f"最佳重叠位置: x={best_x}, 差异值={best_diff}")

                # 创建新图像
                new_width = best_x + w2
                new_result = np.zeros((h1, new_width, 3), dtype=np.uint8)

                # 复制第一张图像
                new_result[:, :w1] = result

                # 创建渐变混合区域
                blend_width = w1 - best_x
                for i in range(blend_width):
                    alpha = i / blend_width
                    new_result[:, best_x + i] = (1 - alpha) * result[:, best_x + i] + alpha * current_img[:, i]

                # 复制第二张图像的剩余部分
                new_result[:, w1:] = current_img[:, blend_width:]

                result = new_result

        print("所有图像拼接完成，开始后处理")
        # 将结果转换为 RGB
        panorama_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)

        # 应用后处理以改善拼接结果
        try:
            # 增强对比度
            lab = cv2.cvtColor(panorama_rgb, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced_lab = cv2.merge((cl, a, b))
            panorama_rgb = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)

            # 轻微锐化以增强细节
            kernel = np.array([[0, -1, 0],
                              [-1, 5, -1],
                              [0, -1, 0]])
            panorama_rgb = cv2.filter2D(panorama_rgb, -1, kernel)

            # 去除拼接边缘的黑边
            # 转换为灰度图
            gray = cv2.cvtColor(panorama_rgb, cv2.COLOR_RGB2GRAY)
            # 二值化找到非黑色区域
            _, thresh = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
            # 找到所有轮廓
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if contours:
                # 找到最大轮廓（主要内容区域）
                max_contour = max(contours, key=cv2.contourArea)
                # 创建掩码
                mask = np.zeros_like(thresh)
                cv2.drawContours(mask, [max_contour], 0, 255, -1)
                # 扩大掩码区域，避免裁剪过紧
                kernel = np.ones((5, 5), np.uint8)
                mask = cv2.dilate(mask, kernel, iterations=2)
                # 获取边界框
                x, y, w, h = cv2.boundingRect(max_contour)
                # 裁剪图像
                panorama_rgb = panorama_rgb[y:y+h, x:x+w]

            # 对于古画，可能需要轻微的降噪处理
            panorama_rgb = cv2.fastNlMeansDenoisingColored(panorama_rgb, None, 3, 3, 7, 21)

        except Exception as e:
            print(f"后处理失败: {str(e)}")

        # 将结果转换为 base64 编码的图像
        img = Image.fromarray(panorama_rgb)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", quality=100, optimize=True)
        img_str = base64.b64encode(buffer.getvalue()).decode()

        # 返回图像尺寸信息
        return {
            "status": "success",
            "image": img_str,
            "dimensions": {
                "width": panorama_rgb.shape[1],
                "height": panorama_rgb.shape[0]
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"顺序拼接过程中出错: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)