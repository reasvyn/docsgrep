# `hunt_related` 🔗

Hunts for documentation related to a specific topic or concept.

## Description

`hunt_related` uses similarity matching to find documents that cover the same domain or concept, even if they are located in different parts of the project. It helps in discovering all relevant documentation for a specific feature or architectural pattern.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to search. |
| `topic` | `string` | Yes | The topic or concept to find related docs for. |
| `threshold` | `number` | No | Similarity threshold 0-1 (default: 0.7). |

## Example

```json
{
  "name": "hunt_related",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "topic": "caching strategy"
  }
}
```

## Response

Returns a list of documentation files related to the specified topic.
