from flask import Flask, request, jsonify
import pandas as pd
import os
from flask_cors import CORS

# Constants
CSV_FILE = "dump.csv"
DEFAULT_STOCK_TYPE = "closing_index_value"

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Helper function to load CSV with error handling
def load_csv(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Error: The file '{file_path}' was not found.")

    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip().str.lower()  # Normalize column names
    required_columns = {"index_name", "index_date", DEFAULT_STOCK_TYPE}
    if not required_columns.issubset(set(df.columns)):
        raise KeyError(f"Missing required columns: {required_columns - set(df.columns)}")
    return df

# Load data
data_frame = load_csv(CSV_FILE)

# Helper function to filter rows by company
def filter_by_company(data, company):
    return data[data["index_name"] == company] if company else data

# Helper function to filter rows by date range
def filter_by_date_range(data, start_date=None, end_date=None):
    if start_date and end_date:
        return data[(data["index_date"] >= start_date) & (data["index_date"] <= end_date)]
    return data

# Function to filter data based on company, date range, and stock type
def filter_data(company, start_date=None, end_date=None, stock_type=DEFAULT_STOCK_TYPE):
    try:
        filtered_data = filter_by_company(data_frame, company)
        if filtered_data.empty:
            return []  # Return empty list if no data found

        filtered_data = filter_by_date_range(filtered_data, start_date, end_date)

        # Check if stock_type exists in the data
        if stock_type not in data_frame.columns:
            raise KeyError(f"Stock type '{stock_type}' not found in CSV columns.")

        # Select all relevant columns for frontend
        required_columns = [
            "index_date", stock_type, "volume", "points_change", "change_percent",
            "pe_ratio", "pb_ratio", "div_yield"
        ]
        available_columns = [col for col in required_columns if col in filtered_data.columns]
        return filtered_data[available_columns].to_dict(orient="records")
    except Exception as e:
        raise Exception(f"Error in filter_data: {str(e)}")

# API route to retrieve a list of companies
@app.route("/companies")
def get_companies():
    return jsonify(data_frame["index_name"].unique().tolist())

# API route to retrieve filtered company data
@app.route("/company")
def get_company_data():
    company = request.args.get("company")
    start_date = request.args.get("start_date", None)
    end_date = request.args.get("end_date", None)
    stock_type = request.args.get("stock_type", DEFAULT_STOCK_TYPE)

    try:
        data = filter_data(company, start_date, end_date, stock_type)
        return jsonify(data)
    except KeyError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred.", "details": str(e)}), 500

# Run the Flask app
if __name__ == "__main__":
    app.run(debug=True)