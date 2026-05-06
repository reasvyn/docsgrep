/**
 * Archetype tool handlers: map_archetypes
 */
import { 
  type McpToolResponse, 
  type MapArchetypesArgs 
} from "../types/tools.js";
import { validateDirPath, validateStringParam } from "../utils/validation.js";
import { ArchetypeEngine } from "../utils/archetype-engine.js";
import { BaseTool } from "./base.js";

export class MapArchetypesTool extends BaseTool<MapArchetypesArgs> {
  name = "map_archetypes";

  async run(args: MapArchetypesArgs): Promise<McpToolResponse> {
    const { dirPath: rawPath, minSimilarity, excludePath } = args;
    const dirPath = validateDirPath(validateStringParam(rawPath, "dirPath"));
    
    const report = await ArchetypeEngine.analyze(
      dirPath, 
      minSimilarity || 0.8, 
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

export async function handleMapArchetypesTool(args: MapArchetypesArgs): Promise<McpToolResponse> {
  return await new MapArchetypesTool().execute(args);
}
