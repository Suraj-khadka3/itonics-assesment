import type { Config } from "jest";
import "tsconfig-paths/register";

const config: Config = {
  rootDir: "./",
  moduleDirectories: ["node_modules", "src"],
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

export default config;
