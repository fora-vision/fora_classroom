from typing import List
import logging
import time

import numpy as np
from numpy import dot
from numpy.linalg import norm

def get_cosine_distance(a, b):
    cos_sim = dot(a, b) / (norm(a) * norm(b))
    return 1 - cos_sim

class BodyFeatureRemover:
    """Класс для удаления фичей относящихся к разным частям телам"""

    def __init__(self):
        self.masks = {}
        self.builded = False
        self.indexes = {
            'hand': [14, 16, 18, 20, 22] + [13, 15, 17, 19, 21],
            'leg': [25, 27, 29, 31] + [26, 28, 30, 32]
        }

    def build_masks(self, feature_names: List[str]):
        """
        Для каждой части тела строим булевую маску, в которой
        True - данная фича лежит относится с данной части тела
        False - не относится
        """
        if self.builded is True:
            return

        self.builded = True
        for k, ids in self.indexes.items():
            self.masks[k] = np.zeros(len(feature_names)).astype(bool)
            for i, name in enumerate(feature_names):
                good = False
                for bad_index in ids:
                    if str(bad_index) in name:
                        good = True
                        break

                if good:
                    self.masks[k][i] = True

    def get_part_feature(self, part, my_features):
        """Зануляет все признаки, не относящиеся к данной части тела"""
        features = my_features.copy()
        for now_part, mask in self.masks.items():
            if now_part == part: continue
            features[:, mask] = 0

        return features


def swap_point(points: np.ndarray, idx1: int, idx2: int):
    points[idx1], points[idx2] = points[idx2], points[idx1]


def flip_points_to_left_side(landmarks: np.ndarray):
    if landmarks[24][2] - landmarks[23][2] < -0.07:
        landmarks[:, 0] = 1 - landmarks[:, 0]
    return landmarks


class SmallFeatureExtractor:
    """Класс для выделения признаков из точек"""

    def __init__(self):
        self.stay_pose = Config['stay_pose']
        self.stay_pose_np = self.get_points_from_landmarks([self.stay_pose], True)[0]

        self._landmark_names = [
            'nose',
            'left_eye_inner', 'left_eye', 'left_eye_outer',
            'right_eye_inner', 'right_eye', 'right_eye_outer',
            'left_ear', 'right_ear',
            'mouth_left', 'mouth_right',
            'left_shoulder', 'right_shoulder',
            'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist',
            'left_pinky_1', 'right_pinky_1',
            'left_index_1', 'right_index_1',
            'left_thumb_2', 'right_thumb_2',
            'left_hip', 'right_hip',
            'left_knee', 'right_knee',
            'left_ankle', 'right_ankle',
            'left_heel', 'right_heel',
            'left_foot_index', 'right_foot_index',
        ]

        self.feature_name = []
        self.feature_remover = BodyFeatureRemover()
        self.get_frame_feature(self.get_points_from_landmarks([self.stay_pose], True)[0])
        self.feature_remover.build_masks(self.feature_name)

    def get_distance_by_names(self, landmarks: np.ndarray, name_from: str, name_to: str, update_feature_name=True):
        """Возвращает расстояние (векторк) между точками с соответсвующими именами"""
        idx_from = self._landmark_names.index(name_from)
        idx_to = self._landmark_names.index(name_to)
        lmk_from = landmarks[idx_from]
        lmk_to = landmarks[idx_to]
        if update_feature_name:
            self.feature_name += ['relative_{}_{}'.format(idx_to, idx_from)] * 3

        return lmk_to - lmk_from

    def normalazing(self, landmarks: np.ndarray):
        """Нормализауют скелетик по расстоянию между левым плечом и левым бедром"""
        dist = self.get_distance_by_names(landmarks, 'left_shoulder', 'left_hip', False)
        dist = (dist ** 2).sum() ** 0.5
        if dist == 0:
            logging.error('null dist in normalazing')
            dist = 0.0000001

        landmarks /= dist
        return landmarks

    def get_angles(self, landmarks):
        """Получим углы в ключевых точках тела"""
        angles = [(16, 14, 12), (14, 12, 24), (12, 24, 26), (24, 26, 28),
                  (15, 13, 11), (13, 11, 23), (11, 23, 25), (23, 25, 27)]
        res = []
        for el in angles:
            a, b, c = [landmarks[el[i]] for i in range(3)]
            res.append(get_cosine_distance(a - b, c - b))
            self.feature_name.append('angle_{}_{}_{}'.format(el[0], el[1], el[2]))
        return res

    def angle_between(self, v1, v2):
        """Находит угол между векторами"""
        v1_u = v1 / np.linalg.norm(v1)
        v2_u = v2 / np.linalg.norm(v2)
        return np.arccos(np.clip(np.dot(v1_u, v2_u), -1.0, 1.0))

    def get_angles_to_horizont(self, landmarks):
        """Информация о расположение тела относительно горизонта"""
        res = []
        v = self.get_distance_by_names(landmarks, 'left_shoulder', 'left_hip', False)
        angle = self.angle_between(v, np.array([1, 0, 0]))
        res.append(np.sin(angle))
        res.append(np.cos(angle))
        res.append(np.cos(angle) > 0)
        res.append(abs(np.sin(angle)) < 0.7)
        self.feature_name += ['angle_to_horizont'] * 4
        return res

    def get_smart_relative(self, landmarks):
        """Получим расстояние между некоторыми точками на теле"""
        distance = np.array([
            self.get_distance_by_names(landmarks, 'left_shoulder', 'left_elbow'),
            self.get_distance_by_names(landmarks, 'right_shoulder', 'right_elbow'),

            self.get_distance_by_names(landmarks, 'left_elbow', 'left_wrist'),
            self.get_distance_by_names(landmarks, 'right_elbow', 'right_wrist'),

            self.get_distance_by_names(landmarks, 'left_hip', 'left_knee'),
            self.get_distance_by_names(landmarks, 'right_hip', 'right_knee'),

            self.get_distance_by_names(landmarks, 'left_knee', 'left_ankle'),
            self.get_distance_by_names(landmarks, 'right_knee', 'right_ankle'),

            self.get_distance_by_names(landmarks, 'left_hip', 'left_shoulder'),
            self.get_distance_by_names(landmarks, 'right_hip', 'right_shoulder'),

            # Two joints.

            self.get_distance_by_names(landmarks, 'left_shoulder', 'left_wrist'),
            self.get_distance_by_names(landmarks, 'right_shoulder', 'right_wrist'),

            self.get_distance_by_names(landmarks, 'left_hip', 'left_ankle'),
            self.get_distance_by_names(landmarks, 'right_hip', 'right_ankle'),

            # Four joints.

            self.get_distance_by_names(landmarks, 'left_hip', 'left_wrist'),
            self.get_distance_by_names(landmarks, 'right_hip', 'right_wrist'),

            # Five joints.

            self.get_distance_by_names(landmarks, 'left_shoulder', 'left_ankle'),
            self.get_distance_by_names(landmarks, 'right_shoulder', 'right_ankle'),

            self.get_distance_by_names(landmarks, 'left_hip', 'left_wrist'),
            self.get_distance_by_names(landmarks, 'right_hip', 'right_wrist'),

            # Cross body.

            self.get_distance_by_names(landmarks, 'left_elbow', 'right_elbow'),
            self.get_distance_by_names(landmarks, 'left_knee', 'right_knee'),

            self.get_distance_by_names(landmarks, 'left_shoulder', 'right_shoulder'),
            self.get_distance_by_names(landmarks, 'left_hip', 'right_hip'),

            self.get_distance_by_names(landmarks, 'left_wrist', 'right_wrist'),
            self.get_distance_by_names(landmarks, 'left_ankle', 'right_ankle'),
        ])
        return distance.flatten().tolist()

    def get_frame_feature(self, landmarks):
        """Соберем все фичи для одного кадра"""
        landmarks = flip_points_to_left_side(landmarks)
        landmarks = self.normalazing(landmarks)
        self.feature_name = []

        res = []
        res += self.get_angles(landmarks)
        res += self.get_angles_to_horizont(landmarks)
        res += self.get_smart_relative(landmarks)
        return np.array(res)

    def get_points_from_landmarks(self, landmarks, use_z, return_norm=False):
        """
        Получим numpy array из landmarks и,
        если return_norm=True вернем маску для кадров для которых видны колени
        """
        norm_points = []
        all_points = []
        for frame in landmarks:
            if frame is None: frame = self.stay_pose
            visibility = []
            points = []


            for i, point in enumerate(frame):
                points.append([point['x'], point['y'], point['z']])
                visibility.append(point['p'] > 0.5)

            all_points.append(points)
            norm_points.append(visibility[26] + visibility[25] > 0 and visibility[11] + visibility[12] > 0)

        all_points = np.array(all_points)
        if use_z == 0:
            all_points[:, :, 2] = 0

        if return_norm:
            # norm_points = [1] * len(all_points)
            logging.info('cnt norm frames {}'.format(sum(norm_points)))
            return all_points, norm_points

        return all_points

    def get_part_feature(self, part, features):
        """Воспользуемся feature_remover, чтобы оставить только признаки относящиеся к данной части тела"""
        return self.feature_remover.get_part_feature(part, features)

    def padding_to_square_numpy(self, landmarks, hor):
        """Поместим человечек в квадрат"""
        if landmarks is None:
            return None

        landmarks = landmarks.astype(np.float64)
        if hor == 1:
            landmarks[:, 1] = landmarks[:, 1] * Config['image_height'] / Config['image_width']
        elif hor == 0:
            landmarks[:, 0] = landmarks[:, 0] * Config['image_width'] / Config['image_height']

        return landmarks

    def get_features(self, landmarks, hor, flip_to_left=True):
        """Получим фичи из точек"""
        ans = []
        all_points, norm = self.get_points_from_landmarks(landmarks, False, True)
        norm = np.array(norm)
        all_points[~norm] = self.stay_pose_np

        for points, now_hor in zip(all_points, hor):
            points = self.padding_to_square_numpy(points, now_hor)
            if flip_to_left:
                points = flip_points_to_left_side(points)
            points[:, 2] = 0
            feature = self.get_frame_feature(points)
            ans.append(feature)

        return np.array(ans)


class SmallPredictor:
    def __init__(self, exercise, use_thresholds=True):
        self.exercise = exercise
        self.use_thresholds = use_thresholds
        
        self.delete_hands = self.exercise in Config['exercise_without_hands']
        self.delete_legs = self.exercise in Config['exercise_without_legs']
        self.not_none_legs = self.exercise in Config['not_none_legs']
        self.not_not_hands = self.exercise in Config['not_not_hands']

        self.classes = [self.exercise + '_up', self.exercise + '_down', Config['none_exercise']]
        self.feature_extractor = SmallFeatureExtractor()
        self.pose_type = ['up', 'down', 'other']
        self.classes = np.array(self.classes)
        self.logger = logging.getLogger()

    def get_real_pose(self, pose_name):
        for k, v in Config['poses_graph'].items():
            if pose_name in v: return k
        return Config['none_exercise']

    def softmax(self, x):
        exp = np.exp(x)
        sum = np.sum(np.exp(x), axis=1).reshape(-1, 1)
        sum = np.concatenate([sum, sum, sum], axis=1)
        return exp / sum

    async def predict_proba(self, x, hor=None):
        start = time.time()
        if hor is None:
            hor = np.ones(len(x)).astype(bool)

        proba = {}
        features = self.feature_extractor.get_features(landmarks=x,
                                                       hor=hor,
                                                       flip_to_left=self.exercise not in Config['no_swap_exercises'])
        self.logger.info('getting features in {}'.format(time.time() - start))

        start = time.time()
        for part in Config['body_parts']:
            now_features = self.feature_extractor.get_part_feature(part, features)

            logits = None
            for i in range(0, len(now_features), Config['model_batch_size']):
                batch = now_features[i:i + Config['model_batch_size']]
                if len(batch) < Config['model_batch_size']:
                    batch = np.concatenate([batch, np.zeros((Config['model_batch_size'] - len(batch), 90))])

                batch = batch.astype(np.float32)
                data = await js_predict(self.exercise, part, batch)
                now_logits = np.array(data.to_py())
                logits = np.concatenate([logits, now_logits]) if logits is not None else now_logits

            proba[part] = self.softmax(logits)

        self.logger.info('making model predict {}'.format(time.time() - start))
        return proba

    async def predict(self, x: list, hor=None, return_parts=False, proba=None):
        start = time.time()
        if proba is None: pred = await self.predict_proba(x, hor)
        else: pred = proba

        self.logger.info('getting proba in {}'.format(time.time() - start))

        start = time.time()
        max_proba = {k: np.max(v, 1) for k, v in pred.items()}
        argmax_proba = {k: np.argmax(v, 1) for k, v in pred.items()}
        body_parts_ans = []
        threshold = Config['exercise_threshold'][self.exercise]

        ans = []
        for i in range(len(x)):
            part_ans = {}
            for part in Config['body_parts']:
                part_ans[part] = 2
                t = self.pose_type[argmax_proba[part][i]]
                if max_proba[part][i] > threshold[t]:
                    part_ans[part] = argmax_proba[part][i]

            body_parts_ans.append(part_ans)
            if self.delete_hands or (self.not_not_hands and argmax_proba['hand'][i] != 2):
                ans.append(self.classes[part_ans['leg']])
                continue

            if self.delete_legs or (self.not_none_legs and argmax_proba['leg'][i] != 2):
                ans.append(self.classes[part_ans['hand']])
                continue

            if part_ans['hand'] == part_ans['leg']:
                ans.append(self.classes[part_ans['hand']])
            else:
                ans.append(self.classes[2])

        self.logger.info('getting results for landmarks in {}'.format(time.time() - start))
        if return_parts:
            return ans, body_parts_ans
        return ans

async def predict_frames(ex, landmarks):
  return await SmallPredictor(ex).predict(landmarks, hor=[True] * len(landmarks), return_parts=True)	
