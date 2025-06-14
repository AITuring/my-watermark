from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import io
from PIL import Image
import base64
import uvicorn
from typing import List
import gc
import sys
import traceback
import math

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加健康检查接口
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "服务正常运行"}

def safe_create_detector(detector_type='sift'):
    """安全创建特征检测器"""
    try:
        if detector_type == 'sift':
            return cv2.SIFT_create(nfeatures=2000)  # 增加特征点数量
        elif detector_type == 'orb':
            return cv2.ORB_create(nfeatures=2000)
        elif detector_type == 'akaze':
            return cv2.AKAZE_create()
        elif detector_type == 'brisk':
            return cv2.BRISK_create()
    except Exception as e:
        print(f"创建{detector_type}检测器失败: {e}")
        return None

def enhance_image(image):
    """增强图像质量以提高特征检测效果"""
    try:
        # 转换为灰度图进行处理
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # 应用CLAHE（对比度限制自适应直方图均衡化）
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        enhanced_gray = clahe.apply(gray)

        # 如果是彩色图像，将增强后的灰度图转换回彩色
        if len(image.shape) == 3:
            # 保持原始颜色信息，只增强亮度
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            lab[:,:,0] = enhanced_gray
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            return enhanced
        else:
            return enhanced_gray

    except Exception as e:
        print(f"图像增强失败: {e}")
        return image

def preprocess_image_simple(image):
    """简化的图像预处理"""
    try:
        # 不再限制图像尺寸，直接返回原图
        return image
    except Exception as e:
        print(f"图像预处理失败: {e}")
        return image

def enhance_image_for_detection(image):
    """专门用于特征检测的图像增强（轻度处理）"""
    try:
        # 轻度锐化，避免过度处理
        kernel = np.array([[0,-1,0],
                          [-1,5,-1],
                          [0,-1,0]])
        sharpened = cv2.filter2D(image, -1, kernel)

        # 轻度对比度增强
        if len(sharpened.shape) == 3:
            lab = cv2.cvtColor(sharpened, cv2.COLOR_BGR2LAB)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            lab[:,:,0] = clahe.apply(lab[:,:,0])
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            return enhanced
        else:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            return clahe.apply(sharpened)

    except Exception as e:
        print(f"图像增强失败: {e}")
        return image

def advanced_feature_matching(img1, img2, detector_type='sift'):
    """简化但稳定的特征匹配算法"""
    try:
        print(f"使用{detector_type}进行特征匹配...")

        # 轻度增强用于特征检测
        enhanced_img1 = enhance_image_for_detection(img1)
        enhanced_img2 = enhance_image_for_detection(img2)

        # 转换为灰度图
        gray1 = cv2.cvtColor(enhanced_img1, cv2.COLOR_BGR2GRAY) if len(enhanced_img1.shape) == 3 else enhanced_img1
        gray2 = cv2.cvtColor(enhanced_img2, cv2.COLOR_BGR2GRAY) if len(enhanced_img2.shape) == 3 else enhanced_img2

        # 创建检测器
        detector = safe_create_detector(detector_type)
        if detector is None:
            return None

        # 检测特征点
        kp1, des1 = detector.detectAndCompute(gray1, None)
        kp2, des2 = detector.detectAndCompute(gray2, None)

        if des1 is None or des2 is None or len(kp1) < 10 or len(kp2) < 10:
            print(f"特征点不足: img1={len(kp1) if kp1 else 0}, img2={len(kp2) if kp2 else 0}")
            return None

        print(f"找到特征点: img1={len(kp1)}, img2={len(kp2)}")

        # 特征匹配
        if detector_type in ['sift', 'akaze']:
            # 使用FLANN匹配器
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            flann = cv2.FlannBasedMatcher(index_params, search_params)
            matches = flann.knnMatch(des1, des2, k=2)
        else:
            # 使用BF匹配器
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            matches = bf.knnMatch(des1, des2, k=2)

        # Lowe's ratio test
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.7 * n.distance:
                    good_matches.append(m)

        print(f"找到{len(good_matches)}个好的匹配点")

        if len(good_matches) < 10:
            print("匹配点不足")
            return None

        # 提取匹配点坐标
        src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

        # 使用单应性矩阵
        H, mask = cv2.findHomography(dst_pts, src_pts,
                                   cv2.RANSAC,
                                   ransacReprojThreshold=5.0,
                                   maxIters=5000,
                                   confidence=0.995)

        if H is None:
            print("无法计算单应性矩阵")
            return None

        # 验证单应性矩阵的质量
        inliers = np.sum(mask)
        inlier_ratio = inliers / len(good_matches)
        matches_count = len(good_matches)

        print(f"内点数量: {inliers}, 内点比例: {inlier_ratio:.2f}")

        if inlier_ratio < 0.3:
            print("单应性矩阵质量不佳")
            return None

        # 返回正确的格式：(H, matches_count, inlier_ratio)
        return H, matches_count, inlier_ratio

    except Exception as e:
        print(f"特征匹配失败: {e}")
        return None

def multi_detector_stitch(img1, img2):
    """使用多种检测器的拼接策略"""
    detectors = ['sift', 'akaze', 'orb', 'brisk']

    for detector_type in detectors:
        print(f"尝试使用{detector_type}检测器...")
        result = advanced_feature_matching(img1, img2, detector_type)

        if result is not None:
            H, matches_count, inlier_ratio = result
            print(f"{detector_type}检测器成功找到匹配，匹配点数：{matches_count}，内点比例：{inlier_ratio:.2f}")

            # 使用单应性矩阵进行拼接
            stitched = stitch_with_homography(img1, img2, H)
            if stitched is not None:
                return stitched
        else:
            print(f"{detector_type}检测器匹配失败")

    return None

def stitch_with_homography(img1, img2, H):
    """使用单应性矩阵进行拼接（回到稳定版本）"""
    try:
        h1, w1 = img1.shape[:2]
        h2, w2 = img2.shape[:2]

        # 计算变换后的角点
        corners2 = np.float32([[0, 0], [w2, 0], [w2, h2], [0, h2]]).reshape(-1, 1, 2)
        corners2_transformed = cv2.perspectiveTransform(corners2, H)

        # 计算输出图像的边界
        corners1 = np.float32([[0, 0], [w1, 0], [w1, h1], [0, h1]]).reshape(-1, 1, 2)
        all_corners = np.concatenate([corners1, corners2_transformed], axis=0)

        min_x = int(np.min(all_corners[:, 0, 0]))
        max_x = int(np.max(all_corners[:, 0, 0]))
        min_y = int(np.min(all_corners[:, 0, 1]))
        max_y = int(np.max(all_corners[:, 0, 1]))

        output_width = max_x - min_x
        output_height = max_y - min_y

        print(f"输出图像尺寸: {output_width}x{output_height}")

        # 检查输出尺寸是否合理
        if output_width <= 0 or output_height <= 0 or output_width > 20000 or output_height > 20000:
            print("输出图像尺寸不合理")
            return None

        # 调整变换矩阵
        translation_matrix = np.array([[1, 0, -min_x], [0, 1, -min_y], [0, 0, 1]])
        H_adjusted = translation_matrix @ H

        # 创建输出图像
        result = np.zeros((output_height, output_width, 3), dtype=np.uint8)

        # 放置第一张图像
        y1_start = -min_y
        y1_end = y1_start + h1
        x1_start = -min_x
        x1_end = x1_start + w1
        result[y1_start:y1_end, x1_start:x1_end] = img1

        # 变换并放置第二张图像
        warped_img2 = cv2.warpPerspective(img2, H_adjusted, (output_width, output_height))

        # 简化的图像融合（回到原有逻辑）
        mask2 = (warped_img2.sum(axis=2) > 0)
        mask1 = (result.sum(axis=2) > 0)
        overlap = mask1 & mask2

        # 在重叠区域进行简单加权融合
        if np.any(overlap):
            alpha = 0.5  # 简单的50-50融合
            result[overlap] = (alpha * result[overlap] + (1-alpha) * warped_img2[overlap]).astype(np.uint8)

        # 非重叠区域直接复制
        non_overlap_mask2 = mask2 & ~overlap
        result[non_overlap_mask2] = warped_img2[non_overlap_mask2]

        print("拼接完成")
        return result

    except Exception as e:
        print(f"拼接过程出错: {e}")
        traceback.print_exc()
        return None

def simple_stitch_two_images(img1, img2):
    """改进的两图拼接函数"""
    try:
        print("开始拼接两张图像...")

        # 预处理图像
        img1 = preprocess_image_simple(img1)
        img2 = preprocess_image_simple(img2)

        # 首先尝试多检测器拼接
        result = multi_detector_stitch(img1, img2)

        if result is not None:
            return result

        print("特征匹配失败，尝试简单拼接...")

        # 如果特征匹配失败，尝试简单的水平或垂直拼接
        h1, w1 = img1.shape[:2]
        h2, w2 = img2.shape[:2]

        # 尝试水平拼接
        if abs(h1 - h2) < min(h1, h2) * 0.3:  # 高度相近
            print("尝试水平拼接...")
            target_height = max(h1, h2)

            # 调整图像高度
            if h1 != target_height:
                img1 = cv2.resize(img1, (w1, target_height))
            if h2 != target_height:
                img2 = cv2.resize(img2, (w2, target_height))

            result = np.hstack([img1, img2])
            print("水平拼接完成")
            return result

        # 尝试垂直拼接
        if abs(w1 - w2) < min(w1, w2) * 0.3:  # 宽度相近
            print("尝试垂直拼接...")
            target_width = max(w1, w2)

            # 调整图像宽度
            if w1 != target_width:
                img1 = cv2.resize(img1, (target_width, h1))
            if w2 != target_width:
                img2 = cv2.resize(img2, (target_width, h2))

            result = np.vstack([img1, img2])
            print("垂直拼接完成")
            return result

        print("无法进行简单拼接")
        return None

    except Exception as e:
        print(f"拼接过程出错: {e}")
        traceback.print_exc()
        return None
    finally:
        gc.collect()

def find_best_stitch_order(images):
    """找到最佳的拼接顺序"""
    try:
        print("分析图像拼接顺序...")
        n = len(images)
        if n <= 2:
            return list(range(n))

        # 计算图像间的相似度矩阵
        similarity_matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(i+1, n):
                # 使用SIFT特征计算相似度
                try:
                    detector = cv2.SIFT_create(nfeatures=500)

                    # 转换为灰度图
                    gray1 = cv2.cvtColor(images[i], cv2.COLOR_BGR2GRAY) if len(images[i].shape) == 3 else images[i]
                    gray2 = cv2.cvtColor(images[j], cv2.COLOR_BGR2GRAY) if len(images[j].shape) == 3 else images[j]

                    # 检测特征点
                    kp1, des1 = detector.detectAndCompute(gray1, None)
                    kp2, des2 = detector.detectAndCompute(gray2, None)

                    if des1 is not None and des2 is not None and len(des1) > 10 and len(des2) > 10:
                        # 使用FLANN匹配器
                        FLANN_INDEX_KDTREE = 1
                        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
                        search_params = dict(checks=50)
                        flann = cv2.FlannBasedMatcher(index_params, search_params)

                        matches = flann.knnMatch(des1, des2, k=2)

                        # Lowe's ratio test
                        good_matches = []
                        for match_pair in matches:
                            if len(match_pair) == 2:
                                m, n = match_pair
                                if m.distance < 0.7 * n.distance:
                                    good_matches.append(m)

                        # 相似度基于好的匹配点数量
                        similarity = len(good_matches)
                        similarity_matrix[i][j] = similarity
                        similarity_matrix[j][i] = similarity

                        print(f"图像{i+1}和图像{j+1}的匹配点数: {similarity}")

                except Exception as e:
                    print(f"计算图像{i+1}和{j+1}相似度失败: {e}")
                    similarity_matrix[i][j] = 0
                    similarity_matrix[j][i] = 0

        # 使用贪心算法找到最佳拼接顺序
        visited = [False] * n
        order = []

        # 从相似度最高的一对开始
        max_sim = 0
        start_i, start_j = 0, 1
        for i in range(n):
            for j in range(i+1, n):
                if similarity_matrix[i][j] > max_sim:
                    max_sim = similarity_matrix[i][j]
                    start_i, start_j = i, j

        order.append(start_i)
        order.append(start_j)
        visited[start_i] = True
        visited[start_j] = True

        # 依次添加与当前序列最相似的图像
        while len(order) < n:
            best_sim = 0
            best_idx = -1

            for i in range(n):
                if not visited[i]:
                    # 计算与当前序列的最大相似度
                    max_sim_to_sequence = 0
                    for j in order:
                        max_sim_to_sequence = max(max_sim_to_sequence, similarity_matrix[i][j])

                    if max_sim_to_sequence > best_sim:
                        best_sim = max_sim_to_sequence
                        best_idx = i

            if best_idx != -1:
                order.append(best_idx)
                visited[best_idx] = True
            else:
                # 添加剩余的图像
                for i in range(n):
                    if not visited[i]:
                        order.append(i)
                        visited[i] = True
                break

        print(f"最佳拼接顺序: {[i+1 for i in order]}")
        return order

    except Exception as e:
        print(f"计算拼接顺序失败: {e}")
        return list(range(len(images)))

def analyze_image_relationships(images):
    """分析图像之间的空间关系 - 使用多检测器策略"""
    try:
        print("分析图像空间关系...")
        n = len(images)
        relationships = {}

        # 为每对图像计算变换关系
        for i in range(n):
            for j in range(i+1, n):
                print(f"分析图像{i+1}和图像{j+1}的关系...")

                # 使用多检测器策略，而不是只用SIFT
                detectors = ['orb', 'akaze', 'sift', 'brisk']  # ORB优先，因为在你的测试中表现最好
                result = None

                for detector_type in detectors:
                    print(f"尝试使用{detector_type}检测器...")
                    result = advanced_feature_matching(images[i], images[j], detector_type)

                    if result is not None:
                        print(f"{detector_type}检测器成功找到匹配")
                        break
                    else:
                        print(f"{detector_type}检测器匹配失败")

                if result is not None:
                    H, matches_count, inlier_ratio = result

                    # 分析变换类型和质量
                    if matches_count > 4 and inlier_ratio > 0.15:  # 使用更宽松的阈值
                        # 计算变换的方向和重叠程度
                        h1, w1 = images[i].shape[:2]
                        h2, w2 = images[j].shape[:2]

                        # 计算图像j相对于图像i的位置
                        corners_j = np.float32([[0, 0], [w2, 0], [w2, h2], [0, h2]]).reshape(-1, 1, 2)
                        transformed_corners = cv2.perspectiveTransform(corners_j, H)

                        # 计算重心偏移
                        center_j_original = np.array([w2/2, h2/2])
                        center_j_transformed = cv2.perspectiveTransform(
                            center_j_original.reshape(1, 1, 2), H
                        )[0, 0]

                        offset_x = center_j_transformed[0] - w1/2
                        offset_y = center_j_transformed[1] - h1/2

                        relationships[(i, j)] = {
                            'homography': H,
                            'matches': matches_count,
                            'inlier_ratio': inlier_ratio,
                            'offset_x': offset_x,
                            'offset_y': offset_y,
                            'quality': matches_count * inlier_ratio
                        }

                        print(f"图像{i+1}→{j+1}: 匹配点{matches_count}, 内点比例{inlier_ratio:.2f}, 偏移({offset_x:.1f}, {offset_y:.1f})")
                else:
                    print(f"图像{i+1}和图像{j+1}无法建立匹配关系")

        return relationships

    except Exception as e:
        print(f"分析图像关系失败: {e}")
        return {}

def build_image_graph(relationships, num_images):
    """构建图像连接图"""
    try:
        print("构建图像连接图...")

        # 创建邻接表
        graph = {i: [] for i in range(num_images)}

        # 按质量排序关系
        sorted_relationships = sorted(
            relationships.items(),
            key=lambda x: x[1]['quality'],
            reverse=True
        )

        # 添加高质量的连接
        for (i, j), rel in sorted_relationships:
            if rel['quality'] > 50:  # 质量阈值
                graph[i].append((j, rel))
                graph[j].append((i, rel))

        return graph

    except Exception as e:
        print(f"构建图像图失败: {e}")
        return {}

def find_optimal_layout(graph, num_images):
    """找到最优的图像布局"""
    try:
        print("计算最优布局...")

        # 找到连接最多的图像作为中心
        center_image = max(range(num_images), key=lambda i: len(graph[i]))
        print(f"选择图像{center_image+1}作为中心")

        # 使用BFS确定拼接顺序
        visited = set()
        layout_order = []
        queue = [center_image]

        while queue:
            current = queue.pop(0)
            if current in visited:
                continue

            visited.add(current)
            layout_order.append(current)

            # 按质量排序邻居
            neighbors = sorted(
                graph[current],
                key=lambda x: x[1]['quality'],
                reverse=True
            )

            for neighbor, _ in neighbors:
                if neighbor not in visited:
                    queue.append(neighbor)

        # 添加未连接的图像
        for i in range(num_images):
            if i not in visited:
                layout_order.append(i)

        print(f"布局顺序: {[i+1 for i in layout_order]}")
        return layout_order

    except Exception as e:
        print(f"计算布局失败: {e}")
        return list(range(num_images))

def smart_multi_image_stitch(images):
    """智能多图拼接 - 基于空间关系的拼接"""
    try:
        print("开始智能多图拼接...")

        if len(images) < 2:
            return None

        if len(images) == 2:
            return simple_stitch_two_images(images[0], images[1])

        # 预处理图像
        processed_images = []
        for i, img in enumerate(images):
            processed = preprocess_image_simple(img)
            processed_images.append(processed)

        # 分析图像关系
        relationships = analyze_image_relationships(processed_images)

        if not relationships:
            print("无法找到图像间的有效关系，使用传统方法")
            return advanced_multi_image_stitch(images)

        # 构建图像图
        graph = build_image_graph(relationships, len(processed_images))

        # 找到最优布局
        layout_order = find_optimal_layout(graph, len(processed_images))

        # 尝试OpenCV Stitcher（使用优化后的顺序）
        ordered_images = [processed_images[i] for i in layout_order]

        stitcher_modes = [cv2.Stitcher_PANORAMA, cv2.Stitcher_SCANS]

        for mode in stitcher_modes:
            try:
                print(f"尝试OpenCV拼接模式: {mode}")
                stitcher = cv2.Stitcher_create(mode)
                stitcher.setPanoConfidenceThresh(0.1)  # 更低的阈值

                status, result = stitcher.stitch(ordered_images)

                if status == cv2.Stitcher_OK:
                    print(f"OpenCV拼接成功，模式: {mode}")
                    return result
                else:
                    print(f"OpenCV拼接失败，状态: {status}")

            except Exception as e:
                print(f"OpenCV模式{mode}异常: {e}")

        # OpenCV失败，使用基于关系的渐进拼接
        print("使用基于关系的渐进拼接...")

        # 从中心图像开始
        center_idx = layout_order[0]
        result = processed_images[center_idx]
        stitched_indices = {center_idx}

        print(f"从中心图像{center_idx+1}开始拼接")

        # 逐步添加最相关的图像
        while len(stitched_indices) < len(processed_images):
            best_candidate = None
            best_quality = 0
            best_relationship = None

            # 找到与已拼接图像最相关的候选图像
            for candidate in range(len(processed_images)):
                if candidate in stitched_indices:
                    continue

                for stitched_idx in stitched_indices:
                    # 检查两个方向的关系
                    rel_key1 = (min(candidate, stitched_idx), max(candidate, stitched_idx))

                    if rel_key1 in relationships:
                        rel = relationships[rel_key1]
                        if rel['quality'] > best_quality:
                            best_quality = rel['quality']
                            best_candidate = candidate
                            best_relationship = rel

            if best_candidate is None:
                print("无法找到更多可拼接的图像")
                break

            # 尝试拼接最佳候选图像
            print(f"尝试拼接图像{best_candidate+1}，质量分数: {best_quality:.1f}")

            candidate_img = processed_images[best_candidate]
            temp_result = simple_stitch_two_images(result, candidate_img)

            if temp_result is None:
                # 尝试反向拼接
                temp_result = simple_stitch_two_images(candidate_img, result)

            if temp_result is not None:
                result = temp_result
                stitched_indices.add(best_candidate)
                print(f"成功拼接图像{best_candidate+1}")
            else:
                print(f"无法拼接图像{best_candidate+1}，跳过")
                # 从候选列表中移除，避免无限循环
                break

        print(f"完成拼接，共处理{len(stitched_indices)}张图像")
        return result

    except Exception as e:
        print(f"智能多图拼接失败: {e}")
        traceback.print_exc()
        return None

def advanced_multi_image_stitch(images):
    """改进的多图拼接算法 - 使用智能拼接"""
    try:
        print("开始高级多图拼接...")

        # 首先尝试智能拼接
        result = smart_multi_image_stitch(images)

        if result is not None:
            return result

        print("智能拼接失败，回退到传统方法...")

        # 预处理所有图像
        processed_images = []
        for i, img in enumerate(images):
            processed = preprocess_image_simple(img)
            processed_images.append(processed)
            print(f"预处理图像{i+1}完成")

        # 尝试OpenCV Stitcher
        stitcher_modes = [
            cv2.Stitcher_PANORAMA,
            cv2.Stitcher_SCANS
        ]

        for mode in stitcher_modes:
            try:
                print(f"尝试拼接模式: {mode}")
                stitcher = cv2.Stitcher_create(mode)
                stitcher.setPanoConfidenceThresh(0.2)

                status, result = stitcher.stitch(processed_images)

                if status == cv2.Stitcher_OK:
                    print(f"拼接成功，使用模式: {mode}")
                    return result
                else:
                    print(f"拼接失败，状态码: {status}")

            except Exception as e:
                print(f"拼接模式{mode}失败: {e}")
                continue

        # 最后的回退方案：简单顺序拼接
        print("使用简单顺序拼接作为最后方案...")
        result = processed_images[0]

        for i in range(1, len(processed_images)):
            print(f"拼接图像{i+1}...")
            temp_result = simple_stitch_two_images(result, processed_images[i])

            if temp_result is not None:
                result = temp_result
                print(f"成功拼接图像{i+1}")
            else:
                print(f"无法拼接图像{i+1}，跳过")

        return result

    except Exception as e:
        print(f"多图拼接失败: {e}")
        traceback.print_exc()
        return None

@app.post("/stitch")
async def stitch_images(files: List[UploadFile] = File(...)):
    print(f"收到拼接请求，图像数量: {len(files)}")

    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要两张图片")

    try:
        print("开始读取图像...")

        # 读取图像
        images = []
        for i, file in enumerate(files):
            print(f"读取第{i+1}张图像: {file.filename}")
            contents = await file.read()

            # 验证图像数据
            if len(contents) == 0:
                raise HTTPException(status_code=400, detail=f"图像{i+1}数据为空")

            try:
                # 转换图像
                pil_image = Image.open(io.BytesIO(contents))
                image = np.array(pil_image)

                # 验证图像有效性
                if image.size == 0:
                    raise HTTPException(status_code=400, detail=f"图像{i+1}无效")

                # 确保是BGR格式
                if len(image.shape) == 3:
                    if image.shape[2] == 4:  # RGBA
                        image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
                    elif image.shape[2] == 3:  # RGB
                        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
                elif len(image.shape) == 2:  # 灰度图
                    image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

                images.append(image)
                print(f"图像{i+1}尺寸: {image.shape}")

            except Exception as e:
                raise HTTPException(status_code=400, detail=f"无法解析图像{i+1}: {str(e)}")

        print(f"成功读取{len(images)}张图像")

        # 根据图像数量选择拼接策略
        if len(images) == 2:
            print("开始两图拼接...")
            result = simple_stitch_two_images(images[0], images[1])

            if result is None:
                print("尝试反向拼接...")
                result = simple_stitch_two_images(images[1], images[0])

            if result is None:
                raise HTTPException(status_code=400, detail="无法拼接这两张图像，请确保图像有足够的重叠区域或相似的尺寸")

        else:
            print("多图拼接...")
            result = advanced_multi_image_stitch(images)

            if result is None:
                raise HTTPException(status_code=400, detail="多图拼接失败，请检查图像质量和重叠区域")

        print("开始编码结果图像...")

        # 验证结果
        if result is None or result.size == 0:
            raise HTTPException(status_code=500, detail="拼接结果无效")

        # 编码结果
        success, buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not success:
            raise HTTPException(status_code=500, detail="图像编码失败")

        encoded_image = base64.b64encode(buffer).decode('utf-8')

        print("拼接任务完成")
        return {"image": encoded_image}

    except HTTPException:
        raise
    except Exception as e:
        print(f"拼接过程发生错误: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")
    finally:
        # 清理内存
        gc.collect()

if __name__ == "__main__":
    print("启动图像拼接服务...")
    print("服务地址: http://0.0.0.0:8000")
    print("API文档: http://0.0.0.0:8000/docs")
    print("健康检查: http://0.0.0.0:8000/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)
