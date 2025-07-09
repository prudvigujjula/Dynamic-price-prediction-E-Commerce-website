import pandas as pd
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logs (0 = all, 1 = info, 2 = warnings, 3 = errors)
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GRU, Dense
from tensorflow.keras.optimizers import Adam
import sys
import json
import traceback

try:
    data = pd.read_csv('sales_data.csv')
except FileNotFoundError:
    print(json.dumps({"error": "sales_data.csv not found"}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({"error": "Failed to load sales_data.csv: {str(e)"}))
    sys.exit(1)

def create_dataset(dat, time_step=100):
    X, y = [], []
    for i in range(len(dat) - time_step):
        X.append(dat[i:(i + time_step), 0])
        y.append(dat[i + time_step, 0])
    return np.array(X), np.array(y)

def predict_sales(column_name, days_to_predict):
    try:
        if column_name not in data.columns:
            raise ValueError(f"Column '{column_name}' not found in dataset")

        column_data = data[column_name].values.reshape(-1, 1)
        time_step = 100

        if len(column_data) <= time_step:
            raise ValueError("Not enough data for the given time step")

        X, y = create_dataset(column_data, time_step)
        train_size = int(len(X) * 0.8)

        if train_size == 0:
            raise ValueError("Not enough data to split into training set")

        X_train, y_train = X[:train_size], y[:train_size]
        X_test, y_test = X[train_size:], y[train_size:]

        X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
        X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

        model = Sequential([
            GRU(units=50, return_sequences=True, input_shape=(X_train.shape[1], 1)),
            GRU(units=50),
            Dense(units=1)
        ])
        model.compile(optimizer=Adam(learning_rate=0.001), loss='mean_squared_error')
        model.fit(X_train, y_train, epochs=10, batch_size=32, verbose=0)

        y_pred = model.predict(X_test, verbose=0).flatten()

        last_sequence = column_data[-time_step:].reshape(1, time_step, 1)
        future_preds = []
        for _ in range(days_to_predict):
            next_pred = model.predict(last_sequence, verbose=0)[0][0]
            future_preds.append(float(next_pred))
            last_sequence = np.roll(last_sequence, -1, axis=1)
            last_sequence[0, -1, 0] = next_pred

        result = {
            "past_values": [float(x) for x in column_data.flatten()],
            "test_actual": [float(x) for x in y_test],
            "test_predicted": [float(x) for x in y_pred],
            "future_predicted": future_preds
        }
        return result

    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}", "traceback": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Invalid arguments. Usage: predict.py <column_name> <days>"}))
        sys.exit(1)

    column_name = sys.argv[1]
    days_to_predict = int(sys.argv[2])
    result = predict_sales(column_name, days_to_predict)
    print(json.dumps(result))