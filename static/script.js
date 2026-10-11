document.addEventListener("DOMContentLoaded", () => {
    // ---------- HTML ELEMENTS ----------
    const taskForm =
        document.getElementById("taskForm") ||
        document.getElementById("task-form");

    const taskList =
        document.getElementById("taskList") ||
        document.getElementById("task-list") ||
        document.getElementById("tasksList") ||
        document.getElementById("tasks-container");

    const titleInput = findInput(
        ["title", "taskTitle", "task-title"],
        'input[name="title"]'
    );

    const subjectInput = findInput(
        ["subject", "taskSubject", "task-subject"],
        'input[name="subject"]'
    );

    const dateInput = findInput(
        ["date", "taskDate", "task-date"],
        'input[name="date"]'
    );

    const priorityInput = findInput(
        ["priority", "taskPriority", "task-priority"],
        'select[name="priority"], input[name="priority"]'
    );

    const totalTasksElement =
        document.getElementById("totalTasks") ||
        document.getElementById("total-tasks");

    const completedTasksElement =
        document.getElementById("completedTasks") ||
        document.getElementById("completed-tasks");

    const pendingTasksElement =
        document.getElementById("pendingTasks") ||
        document.getElementById("pending-tasks");

    const progressText = document.getElementById("progress-text");
    const progressCount = document.getElementById("progress-count");
    const progressBar = document.getElementById("progress-bar");

    let tasks = [];
    let currentFilter = "all";

    // Find an input by its possible ID or name.
    function findInput(ids, selector) {
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) return element;
        }

        return taskForm ? taskForm.querySelector(selector) : null;
    }

    // ---------- LOAD TASKS ----------
    async function loadTasks() {
        try {
            const response = await fetch("/api/tasks");

            if (!response.ok) {
                throw new Error("Could not load tasks.");
            }

            const data = await response.json();

            // Supports either an array or { tasks: [...] }.
            tasks = Array.isArray(data) ? data : (data.tasks || []);

            renderTasks();
        } catch (error) {
            console.error("Loading tasks failed:", error);
            showMessage("Could not load tasks. Check that Flask is running.");
        }
    }

    // ---------- DISPLAY TASKS ----------
    function renderTasks() {
        if (!taskList) {
            console.error(
                'Task list element not found. Check the ID in index.html.'
            );
            return;
        }

        taskList.replaceChildren();

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(
            task => isCompleted(task.completed)
        ).length;

        const pendingTasks = totalTasks - completedTasks;

        // Update task counters.
        if (totalTasksElement) {
            totalTasksElement.textContent = totalTasks;
        }

        if (completedTasksElement) {
            completedTasksElement.textContent = completedTasks;
        }

        if (pendingTasksElement) {
            pendingTasksElement.textContent = pendingTasks;
        }

        // Update progress bar.
        const progress = totalTasks === 0
            ? 0
            : Math.round((completedTasks / totalTasks) * 100);

        if (progressText) {
            progressText.textContent = `${progress}% completed`;
        }

        if (progressCount) {
            progressCount.textContent =
                `${completedTasks} of ${totalTasks} tasks`;
        }

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute("aria-valuenow", String(progress));
        }

        // Apply the selected filter.
        const visibleTasks = tasks.filter(task => {
            if (currentFilter === "completed") {
                return isCompleted(task.completed);
            }

            if (currentFilter === "pending") {
                return !isCompleted(task.completed);
            }

            return true;
        });

        if (visibleTasks.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "empty-message";
            emptyMessage.textContent = totalTasks === 0
                ? "No study tasks yet. Add your first task!"
                : "No tasks found for this filter.";

            taskList.appendChild(emptyMessage);
            return;
        }

        visibleTasks.forEach(task => {
            const card = document.createElement("div");
            card.className = "task-card";

            if (isCompleted(task.completed)) {
                card.classList.add("completed");
            }

            const heading = document.createElement("h3");
            heading.textContent = task.title || "Untitled task";

            const subject = document.createElement("p");
            subject.textContent = `Subject: ${task.subject || "Not specified"}`;

            const date = document.createElement("p");
            date.textContent = `Date: ${task.date || "No date"}`;

            const priority = document.createElement("p");
            priority.textContent = `Priority: ${task.priority || "Normal"}`;

            const status = document.createElement("p");
            status.textContent = isCompleted(task.completed)
                ? "Status: Completed"
                : "Status: Pending";

            const buttons = document.createElement("div");
            buttons.className = "task-buttons";

            const completeButton = document.createElement("button");
            completeButton.type = "button";
            completeButton.textContent = isCompleted(task.completed)
                ? "Mark Pending"
                : "Complete";
            completeButton.addEventListener("click", () => {
                toggleTask(task);
            });

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => {
                editTask(task);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => {
                deleteTask(task.id);
            });

            buttons.append(
                completeButton,
                editButton,
                deleteButton
            );

            card.append(
                heading,
                subject,
                date,
                priority,
                status,
                buttons
            );

            taskList.appendChild(card);
        });
    }

    // Handle SQLite values such as 0/1 and boolean values.
    function isCompleted(value) {
        return value === true || value === 1 || value === "1";
    }

    // ---------- ADD TASK ----------
    if (taskForm) {
        taskForm.addEventListener("submit", async event => {
            event.preventDefault();

            if (!titleInput || !subjectInput || !dateInput || !priorityInput) {
                showMessage(
                    "A task form field was not found. Check the input IDs in index.html."
                );
                return;
            }

            const task = {
                title: titleInput.value.trim(),
                subject: subjectInput.value.trim(),
                date: dateInput.value,
                priority: priorityInput.value
            };

            if (!task.title || !task.subject || !task.date || !task.priority) {
                showMessage("Please fill in all task fields.");
                return;
            }

            try {
                const response = await fetch("/api/tasks", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(task)
                });

                if (!response.ok) {
                    throw new Error("Could not add task.");
                }

                taskForm.reset();
                await loadTasks();
            } catch (error) {
                console.error("Adding task failed:", error);
                showMessage("Task could not be added. Check app.py and the terminal.");
            }
        });
    } else {
        console.error("Task form not found. Check its ID in index.html.");
    }

    // ---------- COMPLETE / UNCOMPLETE TASK ----------
    async function toggleTask(task) {
        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    completed: !isCompleted(task.completed)
                })
            });

            if (!response.ok) {
                throw new Error("Could not update task status.");
            }

            await loadTasks();
        } catch (error) {
            console.error("Updating task failed:", error);
            showMessage("Could not update task status.");
        }
    }

    // ---------- EDIT TASK ----------
    async function editTask(task) {
        const title = prompt("Enter task title:", task.title || "");
        if (title === null) return;

        const subject = prompt("Enter subject:", task.subject || "");
        if (subject === null) return;

        const date = prompt(
            "Enter date (YYYY-MM-DD):",
            task.date || ""
        );
        if (date === null) return;

        const priority = prompt(
            "Enter priority (Low, Medium, or High):",
            task.priority || "Medium"
        );
        if (priority === null) return;

        if (!title.trim() || !subject.trim() || !date.trim() || !priority.trim()) {
            showMessage("Task fields cannot be empty.");
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${task.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: title.trim(),
                    subject: subject.trim(),
                    date: date.trim(),
                    priority: priority.trim()
                })
            });

            if (!response.ok) {
                throw new Error("Could not edit task.");
            }

            await loadTasks();
        } catch (error) {
            console.error("Editing task failed:", error);
            showMessage(
                "Could not edit task. Make sure the PUT route exists in app.py."
            );
        }
    }

    // ---------- DELETE TASK ----------
    async function deleteTask(taskId) {
        if (!confirm("Are you sure you want to delete this task?")) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Could not delete task.");
            }

            await loadTasks();
        } catch (error) {
            console.error("Deleting task failed:", error);
            showMessage("Could not delete task.");
        }
    }

    // ---------- FILTER TASKS ----------
    // Supports a select element with id="taskFilter".
    const filterSelect =
        document.getElementById("taskFilter") ||
        document.getElementById("task-filter");

    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            currentFilter = filterSelect.value.toLowerCase();
            renderTasks();
        });
    }

    // Also supports filter buttons with data-filter="all/completed/pending".
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            currentFilter = button.dataset.filter.toLowerCase();
            renderTasks();
        });
    });

    function showMessage(message) {
        alert(message);
    }

    // Load existing tasks when the page opens.
    loadTasks();
});