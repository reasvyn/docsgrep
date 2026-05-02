import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function main() {
  const serverPath = path.join(__dirname, "build", "index.js");
  
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  console.log("Connecting to MCP server...");
  await client.connect(transport);
  console.log("Connected!\n");

  console.log("Requesting list of tools...");
  const tools = await client.listTools();
  console.log("Available tools:", JSON.stringify(tools, null, 2));

  console.log("\nTesting init_workspace tool on the current directory...");
  try {
    const result = await client.callTool({
      name: "init_workspace",
      arguments: {
        projectPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting analyze_project_tech_stack tool on the current directory...");
  try {
    const result = await client.callTool({
      name: "analyze_project_tech_stack",
      arguments: {
        dirPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting gather_project_conventions tool on the current directory...");
  try {
    const result = await client.callTool({
      name: "gather_project_conventions",
      arguments: {
        dirPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting sample_codebase_patterns tool on the current directory...");
  try {
    const result = await client.callTool({
      name: "sample_codebase_patterns",
      arguments: {
        dirPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting explore_local_docs tool on the current project directory...");
  try {
    const result = await client.callTool({
      name: "explore_local_docs",
      arguments: {
        dirPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting explore_remote_repo tool on octocat/Spoon-Knife (default branch)...");
  try {
    const result = await client.callTool({
      name: "explore_remote_repo",
      arguments: {
        repoUrl: "https://github.com/octocat/Spoon-Knife.git",
        localProjectPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  console.log("\nTesting explore_remote_repo tool on octocat/Spoon-Knife (test-branch)...");
  try {
    const result = await client.callTool({
      name: "explore_remote_repo",
      arguments: {
        repoUrl: "https://github.com/octocat/Spoon-Knife.git",
        branch: "test-branch",
        localProjectPath: __dirname,
      },
    });
    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  process.exit(0);
}

main().catch(console.error);
