/**
 * CLI engine — argument parsing, display, and tool dispatch for `docsgrep run <tool>`
 */
import { CliFormatter } from "./utils/formatter.js";
import { PluginManager } from "./utils/plugin-manager.js";
import { ToolRegistry } from "./tools/registry.js";
import { type McpToolResponse } from "./types/tools.js";

export async function runCli(cliArgs: string[]) {
  const toolName = cliArgs[0];
  const coreTools = ToolRegistry.getCoreToolNames();
  const pluginTools = PluginManager.getRegisteredToolDefinitions().map(t => t.name);
  const availableTools = [...coreTools, ...pluginTools];

  if (!toolName || !availableTools.includes(toolName)) {
    displayCliHelp(availableTools);
    process.exit(toolName ? 1 : 0);
  }

  const { args, format } = parseCliArgs(cliArgs.slice(1));
  if (!args.dirPath && !args.projectPath && !args.filePath) {
    args.dirPath = process.cwd();
  }

  console.log(`\n🚀 docsgrep: Running tool '${toolName}'...`); // docsgrep-ignore

  try {
    const response = await ToolRegistry.execute(toolName, args);
    handleCliResponse(response, toolName, format);
  } catch (err: any) {
    console.error(`\n❌ Fatal Error: ${err.message}`); // docsgrep-ignore
    process.exit(1);
  }
}

function displayCliHelp(tools: string[]) {
  console.log("\n📖 docsgrep CLI - Clean Code & Documentation Assistant"); // docsgrep-ignore
  console.log("Usage: docsgrep run {tool_name} [--param value] [--format text|json]"); // docsgrep-ignore
  console.log("\nOptions:"); // docsgrep-ignore
  console.log("  --format   Output format: 'text' (default) or 'json'"); // docsgrep-ignore
  console.log("\nAvailable tools:"); // docsgrep-ignore
  tools.sort().forEach(t => console.log(`  - ${t}`)); // docsgrep-ignore
  console.log("\nExample: npm run lint OR npx docsgrep run analyze_code --dirPath ./src --format text"); // docsgrep-ignore
}

export function parseCliArgs(cliArgs: string[]) {
  const toolArgs: any = {};
  let fmt = "text";

  const len = cliArgs.length;
  for (let i = 0; i < len; i++) {
    const arg = cliArgs[i];
    if (!arg.startsWith("--")) continue;

    const [key, val] = arg.replace(/^--/, "").split("=");
    const final = getVal(cliArgs, i, val);
    if (val === undefined && final !== true) i++;

    if (key === "format") fmt = final;
    else toolArgs[key] = final;
  }
  return { args: toolArgs, format: fmt };
}

function getVal(args: string[], i: number, v: string | undefined): any {
  if (v !== undefined) return parseVal(v);
  const next = args[i + 1];
  if (next && !next.startsWith("--")) return parseVal(next);
  return true;
}

function parseVal(val: string): any {
  if (val === "true") return true;
  if (val === "false") return false;
  if (!isNaN(Number(val)) && val.trim() !== "") return Number(val);
  if (val.includes(",")) return val.split(",").map(item => item.trim());
  return val;
}

function handleCliResponse(res: McpToolResponse, tool: string, fmt: string) {
  if (res.isError) {
    console.error(`\n❌ Error:`, res.content[0].text); // docsgrep-ignore
    process.exit(1);
  }

  const text = res.content[0].text;
  if (fmt === "json") {
    outJson(text);
  } else {
    console.log(CliFormatter.format(text, tool)); // docsgrep-ignore
  }
}

function outJson(text: string) {
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2)); // docsgrep-ignore
  } catch {
    console.log(text); // docsgrep-ignore
  }
}
