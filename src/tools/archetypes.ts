/**
 * Archetype tool handlers: detect_patterns
 */
import { 
  type McpToolResponse, 
  type DetectPatternsArgs 
} from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { ArchetypeEngine } from "../utils/archetype-engine.js";
import { BaseTool } from "./base.js";

export class DetectPatternsTool extends BaseTool<DetectPatternsArgs> {
  name = "detect_patterns";

  async run(args: DetectPatternsArgs): Promise<McpToolResponse> {
    const { dirPath: rawPath, minSimilarity, includePath, excludePath } = args;
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    
    const report = await ArchetypeEngine.analyze(
      dirPath, 
      minSimilarity || 0.8, 
      includePath,
      excludePath
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }
}

export async function handleDetectPatternsTool(args: DetectPatternsArgs): Promise<McpToolResponse> {
  return await new DetectPatternsTool().execute(args); // docsgrep-ignore
}
