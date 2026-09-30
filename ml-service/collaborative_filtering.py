"""
collaborative_filtering.py
Implicit Alternating Least Squares (ALS) Matrix Factorization for Collaborative Filtering.
Based on Hu, Koren, Volinsky (2008): "Collaborative Filtering for Implicit Feedback Datasets".
Pure NumPy implementation — no complex C dependencies or broken packages.
"""

import numpy as np
import pickle
import os

class ImplicitALS:
    def __init__(self, factors=32, regularization=0.08, iterations=15, alpha=40.0):
        self.factors = factors
        self.regularization = regularization
        self.iterations = iterations
        self.alpha = alpha
        
        self.user_factors = None
        self.item_factors = None
        self.user_to_idx = {}
        self.idx_to_user = {}
        self.item_to_idx = {}
        self.idx_to_item = {}

    def fit(self, interactions):
        """
        interactions: list of dicts with keys:
          'userId': str, 'productId': str, 'weight': float (positive for likes/dwell, etc.)
        """
        if not interactions:
            raise ValueError("No interaction events provided for training.")

        # Build index maps
        users = sorted(list(set(i['userId'] for i in interactions if i.get('userId'))))
        items = sorted(list(set(i['productId'] for i in interactions if i.get('productId'))))

        self.user_to_idx = {u: idx for idx, u in enumerate(users)}
        self.idx_to_user = {idx: u for idx, u in enumerate(users)}
        self.item_to_idx = {it: idx for idx, it in enumerate(items)}
        self.idx_to_item = {idx: it for idx, it in enumerate(items)}

        n_users = len(users)
        n_items = len(items)

        if n_users == 0 or n_items == 0:
            raise ValueError("Insufficient unique users or items for matrix factorization.")

        # Build dense R matrix of implicit signals
        R = np.zeros((n_users, n_items), dtype=np.float32)
        for i in interactions:
            u = i.get('userId')
            it = i.get('productId')
            if u in self.user_to_idx and it in self.item_to_idx:
                u_idx = self.user_to_idx[u]
                i_idx = self.item_to_idx[it]
                w = float(i.get('weight', 1.0))
                R[u_idx, i_idx] = max(0.0, R[u_idx, i_idx] + w)

        # Confidence matrix C = 1 + alpha * R
        C = 1.0 + self.alpha * R
        # Preference matrix P = (R > 0)
        P = (R > 0).astype(np.float32)

        # Initialize factors with small random values
        rng = np.random.RandomState(42)
        X = rng.normal(0, 0.01, size=(n_users, self.factors)).astype(np.float32)
        Y = rng.normal(0, 0.01, size=(n_items, self.factors)).astype(np.float32)

        lambda_eye = self.regularization * np.eye(self.factors, dtype=np.float32)

        for iteration in range(self.iterations):
            # 1. Update user factors X
            YtY = Y.T @ Y
            for u in range(n_users):
                Cu = C[u, :]
                Pu = P[u, :]
                # (Cu - 1) is non-zero only where interactions occurred
                diag_idx = np.where(Cu > 1.0)[0]
                if len(diag_idx) == 0:
                    continue
                Y_sub = Y[diag_idx, :]
                Cu_sub = Cu[diag_idx]
                
                A = YtY + (Y_sub.T * (Cu_sub - 1.0)) @ Y_sub + lambda_eye
                b = Y_sub.T @ (Cu_sub * Pu[diag_idx])
                X[u, :] = np.linalg.solve(A, b)

            # 2. Update item factors Y
            XtX = X.T @ X
            for i in range(n_items):
                Ci = C[:, i]
                Pi = P[:, i]
                diag_idx = np.where(Ci > 1.0)[0]
                if len(diag_idx) == 0:
                    continue
                X_sub = X[diag_idx, :]
                Ci_sub = Ci[diag_idx]

                A = XtX + (X_sub.T * (Ci_sub - 1.0)) @ X_sub + lambda_eye
                b = X_sub.T @ (Ci_sub * Pi[diag_idx])
                Y[i, :] = np.linalg.solve(A, b)

        self.user_factors = X
        self.item_factors = Y

        return {
            'users_count': n_users,
            'items_count': n_items,
            'interactions_count': len(interactions),
            'factors': self.factors,
            'iterations': self.iterations
        }

    def predict(self, user_id, item_id):
        if user_id not in self.user_to_idx or item_id not in self.item_to_idx:
            return 0.0
        u_idx = self.user_to_idx[user_id]
        i_idx = self.item_to_idx[item_id]
        return float(np.dot(self.user_factors[u_idx], self.item_factors[i_idx]))

    def rank_items(self, user_id, candidate_item_ids):
        """Rank a specific list of item IDs for a user"""
        if user_id not in self.user_to_idx:
            return [(item_id, 0.0) for item_id in candidate_item_ids]

        u_idx = self.user_to_idx[user_id]
        u_vec = self.user_factors[u_idx]

        ranked = []
        for it in candidate_item_ids:
            score = 0.0
            if it in self.item_to_idx:
                i_idx = self.item_to_idx[it]
                score = float(np.dot(u_vec, self.item_factors[i_idx]))
            ranked.append((it, score))

        ranked.sort(key=lambda x: x[1], reverse=True)
        return ranked

    def recommend(self, user_id, n=10):
        """Recommend top N items for a user"""
        if user_id not in self.user_to_idx:
            return []

        u_idx = self.user_to_idx[user_id]
        scores = self.user_factors[u_idx] @ self.item_factors.T
        top_indices = np.argsort(scores)[::-1][:n]

        return [
            {'productId': self.idx_to_item[idx], 'score': float(scores[idx])}
            for idx in top_indices
        ]

    def save(self, filepath='model/cf_model.pkl'):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'wb') as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, filepath='model/cf_model.pkl'):
        if not os.path.exists(filepath):
            return None
        with open(filepath, 'rb') as f:
            return pickle.load(f)
