## 2026-05-11 - [Mobile Icon-Only Button Accessibility]

**Learning:** In React Native/Expo development, icon-only buttons (like Search or Filter) are completely opaque to screen readers if they lack an `accessibilityLabel`. Unlike web where `sr-only` text is a common pattern, mobile requires the explicit `accessibilityLabel` prop on the `Pressable` or `TouchableOpacity` component.
**Action:** Always audit mobile screens for `size="icon"` buttons and ensure they have a descriptive `accessibilityLabel` that conveys intent (e.g., "Filter activity" instead of just "Filter").

### UX Learnings

- **Authentication Forms:** The `@keiri/ui` `<Button>` component does not have a built-in `loading` prop. To present a loading state to the user during form submission (e.g., during sign in/up), we should explicitly conditionally render a spinner like `Loader2Icon` from `lucide-react` with an `animate-spin` class, rather than just changing the text.
