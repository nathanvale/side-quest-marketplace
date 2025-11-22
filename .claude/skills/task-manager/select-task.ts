#!/usr/bin/env node
/**
 * Task Selection Script for task-manager skill
 *
 * Reads task files from docs/tasks/ directory, filters by READY status,
 * prioritizes by P0 > P1 > P2 > P3, and returns JSON output.
 *
 * Usage:
 *   pnpm tsx select-task.ts                    # Select next ready task
 *   pnpm tsx select-task.ts --task-id=T0001    # Select specific task
 *   pnpm tsx select-task.ts --show-ready       # List all ready tasks
 */

import * as fs from "fs";
import * as path from "path";

// Task interface matching YAML frontmatter structure
interface TaskFrontmatter {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  component: string;
  status: "TODO" | "READY" | "IN_PROGRESS" | "DONE";
  created: string;
  source: string;
}

interface Task extends TaskFrontmatter {
  filePath: string;
}

interface ScriptOutput {
  success: boolean;
  task?: Task;
  readyTasks?: Task[];
  error?: string;
  message?: string;
}

// Priority order for sorting
const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

/**
 * Parse YAML frontmatter from markdown file
 * Expects format:
 * ---
 * key: value
 * ---
 */
function parseFrontmatter(content: string): TaskFrontmatter | null {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatter: Partial<TaskFrontmatter> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    // Parse value (remove quotes if present)
    const parsedValue = value.replace(/^['"]|['"]$/g, "");

    // @ts-expect-error - Dynamic key assignment
    frontmatter[key] = parsedValue;
  }

  // Validate required fields
  if (!frontmatter.id || !frontmatter.title || !frontmatter.priority || !frontmatter.status) {
    return null;
  }

  return frontmatter as TaskFrontmatter;
}

/**
 * Read all task files from docs/tasks/ directory
 */
function readTaskFiles(tasksDir: string): Task[] {
  const tasks: Task[] = [];

  try {
    const files = fs.readdirSync(tasksDir);

    for (const file of files) {
      // Match pattern: T####-*.md
      if (!file.match(/^T\d{4}-.*\.md$/)) {
        continue;
      }

      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);

      if (frontmatter) {
        tasks.push({
          ...frontmatter,
          filePath: path.relative(process.cwd(), filePath),
        });
      }
    }
  } catch (error) {
    console.error(
      `Error reading tasks directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return tasks;
}

/**
 * Filter tasks by READY status
 */
function filterReadyTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.status === "READY");
}

/**
 * Sort tasks by priority (P0 > P1 > P2 > P3)
 */
function sortTasksByPriority(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority] ?? 999;
    const priorityB = PRIORITY_ORDER[b.priority] ?? 999;
    return priorityA - priorityB;
  });
}

/**
 * Find task by ID
 */
function findTaskById(tasks: Task[], taskId: string): Task | undefined {
  return tasks.find((task) => task.id === taskId);
}

/**
 * Main execution
 */
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const taskIdArg = args.find((arg) => arg.startsWith("--task-id="));
  const showReady = args.includes("--show-ready");

  const taskId = taskIdArg?.split("=")[1];

  // Determine tasks directory (relative to project root)
  const projectRoot = process.cwd();
  const tasksDir = path.join(projectRoot, "docs", "tasks");

  // Verify tasks directory exists
  if (!fs.existsSync(tasksDir)) {
    const output: ScriptOutput = {
      success: false,
      error: `Tasks directory not found: ${tasksDir}`,
      message: "Make sure you are running this script from the project root directory.",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  // Read all task files
  const allTasks = readTaskFiles(tasksDir);

  if (allTasks.length === 0) {
    const output: ScriptOutput = {
      success: false,
      error: "No task files found in docs/tasks/",
      message: "Create task files matching pattern T####-*.md",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  // Handle --show-ready flag
  if (showReady) {
    const readyTasks = sortTasksByPriority(filterReadyTasks(allTasks));
    const output: ScriptOutput = {
      success: true,
      readyTasks,
      message: `Found ${readyTasks.length} ready tasks`,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  // Handle --task-id flag
  if (taskId) {
    const task = findTaskById(allTasks, taskId);

    if (!task) {
      const output: ScriptOutput = {
        success: false,
        error: `Task not found: ${taskId}`,
        message: "Use --show-ready to list all available tasks",
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }

    if (task.status !== "READY") {
      const output: ScriptOutput = {
        success: false,
        error: `Task ${taskId} is not READY (current status: ${task.status})`,
        message: "Only READY tasks can be started. Use --show-ready to find ready tasks.",
        task,
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }

    const readyTasks = sortTasksByPriority(filterReadyTasks(allTasks));
    const output: ScriptOutput = {
      success: true,
      task,
      readyTasks,
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  // Default: Select next ready task by priority
  const readyTasks = sortTasksByPriority(filterReadyTasks(allTasks));

  if (readyTasks.length === 0) {
    const output: ScriptOutput = {
      success: false,
      error: "No READY tasks found",
      message: "All tasks are either TODO, IN_PROGRESS, or DONE",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const nextTask = readyTasks[0]!;
  const output: ScriptOutput = {
    success: true,
    task: nextTask,
    readyTasks,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// Execute main function
main();
