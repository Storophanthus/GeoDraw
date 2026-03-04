import {
  getUiCssVariables,
  getUiProfileBaseVariables,
  UI_CSS_VARIABLE_DEFAULTS,
  type UiCssVariables,
} from "../../state/colorProfiles";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const vanilla = getUiProfileBaseVariables("vanilla");
const beige = getUiProfileBaseVariables("beige");

assert(
  vanilla["--gd-ui-app-bg"] === UI_CSS_VARIABLE_DEFAULTS["--gd-ui-app-bg"],
  "vanilla profile should match default app background token"
);
assert(vanilla["--gd-ui-app-bg"] !== beige["--gd-ui-app-bg"], "beige profile should override app background token");

const overrides: Partial<UiCssVariables> = {
  "--gd-ui-accent": "#112233",
  "--gd-ui-text": "  #445566  ",
  "--gd-ui-border": "   ",
};
const merged = getUiCssVariables("vanilla", overrides);

assert(merged["--gd-ui-accent"] === "#112233", "custom accent override should apply");
assert(merged["--gd-ui-text"] === "#445566", "custom text override should trim whitespace");
assert(
  merged["--gd-ui-border"] === vanilla["--gd-ui-border"],
  "blank border override should be ignored and fall back to preset value"
);

console.log("ui-color-profile-overrides tests: OK");
