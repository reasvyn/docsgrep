# Docsgrep Plugin Development Guide

Docsgrep supports a modular plugin system that allows you to add custom tools and extend its capabilities.

## Plugin Structure

A Docsgrep plugin is an ESM module that exports an object matching the `DocsgrepPlugin` interface.

```typescript
export default {
  name: "my-custom-plugin",
  version: "1.0.0",
  description: "Adds custom auditing tools",
  tools: {
    definitions: [
      {
        name: "audit_naming",
        description: "Checks if naming follows custom company standards",
        inputSchema: {
          type: "object",
          properties: {
            dirPath: { type: "string", description: "Path to audit" }
          },
          required: ["dirPath"]
        }
      }
    ],
    handlers: {
      "audit_naming": async (args) => {
        // Your logic here
        return {
          content: [
            { type: "text", text: "Audit results..." }
          ]
        };
      }
    }
  },
  onLoad: async () => {
    console.log("Plugin loaded!");
  }
};
```

## Discovery Mechanisms

Docsgrep looks for plugins in two ways:

1.  **Auto-discovery**: It scans your local `node_modules` for packages starting with `docsgrep-plugin-` or `@docsgrep/plugin-`.
2.  **Explicit Config**: In your `docsgrep.config.json` file:

```json
{
  "plugins": [
    "./local-plugins/my-plugin",
    "some-external-package"
  ]
}
```

## Example Use Cases
-   `docsgrep-plugin-laravel`: Adds tools to check Eloquent relationships or route definitions.
-   `docsgrep-plugin-prettier`: Integrates Prettier checks into the `analyze_code` flow or as standalone tool.
-   `docsgrep-plugin-nextjs`: Validates app directory structure or server component usage.

## Best Practices
-   **Security**: Never leak credentials or access unauthorized files in your plugin.
-   **Performance**: Avoid heavy operations in `onLoad`.
-   **Standardized Output**: Use `CliFormatter` or return structured JSON for consistent terminal reports.
