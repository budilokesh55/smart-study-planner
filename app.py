from flask import Flask, render_template, request, jsonify
import sqlite3
from pathlib import Path

app = Flask(__name__)

# Database file in the main project folder
DATABASE = Path(__file__).with_name("study_planner.db")


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# Create the database table automatically
def initialize_database():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                subject TEXT NOT NULL,
                date TEXT NOT NULL,
                priority TEXT NOT NULL
                    CHECK(priority IN ('High', 'Medium', 'Low')),
                completed INTEGER NOT NULL DEFAULT 0
                    CHECK(completed IN (0, 1))
            )
        """)


def task_to_dict(task):
    return {
        "id": task["id"],
        "title": task["title"],
        "subject": task["subject"],
        "date": task["date"],
        "priority": task["priority"],
        "completed": bool(task["completed"])
    }
# Display the website
@app.route("/")
def home():
    return render_template("index.html")


# Get all tasks
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    with get_db() as connection:
        tasks = connection.execute(
            "SELECT * FROM tasks ORDER BY id DESC"
        ).fetchall()

    return jsonify([task_to_dict(task) for task in tasks])


# Add a task
@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON data"}), 400

    title = data.get("title")
    subject = data.get("subject")
    date = data.get("date")
    priority = data.get("priority", "Medium")

    if not all(isinstance(value, str) and value.strip()
               for value in (title, subject, date)):
        return jsonify({
            "error": "Title, subject, and deadline are required"
        }), 400

    title = title.strip()
    subject = subject.strip()

    if len(title) > 200 or len(subject) > 100:
        return jsonify({"error": "Text is too long"}), 400

    if priority not in ("High", "Medium", "Low"):
        return jsonify({"error": "Invalid priority"}), 400

    # Validate the date format
    from datetime import date as Date
    try:
        Date.fromisoformat(date)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    with get_db() as connection:
        cursor = connection.execute("""
            INSERT INTO tasks (title, subject, date, priority)
            VALUES (?, ?, ?, ?)
        """, (title, subject, date, priority))

        task = connection.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

    return jsonify(task_to_dict(task)), 201


# Update task completion status
@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON data"}), 400

    if not isinstance(data.get("completed"), bool):
        return jsonify({
            "error": "A true or false completed value is required"
        }), 400

    with get_db() as connection:
        cursor = connection.execute("""
            UPDATE tasks
            SET completed = ?
            WHERE id = ?
        """, (int(data["completed"]), task_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

        task = connection.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_id,)
        ).fetchone()

    return jsonify(task_to_dict(task))
# Delete a task
# Edit task details
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def edit_task(task_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON data"}), 400

    title = data.get("title")
    subject = data.get("subject")
    date = data.get("date")
    priority = data.get("priority")

    if not all(
        isinstance(value, str) and value.strip()
        for value in (title, subject, date, priority)
    ):
        return jsonify({"error": "All fields are required"}), 400

    title = title.strip()
    subject = subject.strip()

    if len(title) > 200 or len(subject) > 100:
        return jsonify({"error": "Text is too long"}), 400

    if priority not in ("High", "Medium", "Low"):
        return jsonify({"error": "Invalid priority"}), 400

    from datetime import date as Date

    try:
        Date.fromisoformat(date)
    except ValueError:
        return jsonify({"error": "Invalid deadline"}), 400

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with get_db() as connection:
        cursor = connection.execute(
            "DELETE FROM tasks WHERE id = ?",
            (task_id,)
        )

        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"})


initialize_database()

if __name__ == "__main__":
    app.run(debug=True)