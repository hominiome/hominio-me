# Design Architecture Guidelines

## Core Principles

### Atomic Design System

- **Always maintain and reuse atomic design principles**
- Organize components into clear hierarchy: Atoms → Molecules → Organisms
- **Upgrade and fine-tune our design system using Tailwind best practices**
- Keep components small, focused, and composable
- Build complex UIs by combining simpler components

### Component Structure

```text
src/lib/design-system/
├── atoms/          # Basic building blocks (Button, Icon, etc.)
├── molecules/      # Simple component groups (Card, PageHeader, etc.)
├── organisms/      # Complex UI sections
└── tokens/         # Design tokens (colors, spacing, etc.)
```

### DRY (Don't Repeat Yourself)

- **Create reusable components wherever possible**
- Extract common patterns into shared components
- Use design system components instead of inline styles
- Avoid duplicating component logic or styling

## Color & Contrast Guidelines

### Title Font Color

**Always use primary brand color for titles:** All titles (`h1`, `h2`, `h3`, etc.) should consistently use the primary brand color (e.g., `text-primary-500`), not plain black (`text-black` or `text-gray-900`), to maintain brand identity and visual consistency.

### Text on Colored Backgrounds

**Critical Rule:** Whenever a design element has a colored background, any text on top of it should always use darker or lighter shades of the same color family for proper contrast.

#### Light Backgrounds (50-400 shades)

- Use **darker shades** (800 or 900) for text
- Example: `bg-accent-50` → `text-accent-800` or `text-accent-900`
- Example: `bg-secondary-100` → `text-secondary-800` or `text-secondary-900`

#### Dark Backgrounds (600-950 shades)

- Use **lighter shades** (100 or 200) for text
- Example: `bg-primary-800` → `text-primary-100` or `text-primary-200`
- Example: `bg-secondary-700` → `text-secondary-100` or `text-secondary-200`

### Brand Colors

- **Primary**: Navy/Blue (`primary-*`) - Main brand color
- **Secondary**: Teal (`secondary-*`) - Accent color
- **Accent**: Yellow (`accent-*`) - Highlight color
- **Surface Light**: Cream/Earth tones (`surface-light-*`) - Light backgrounds and text

### Co-Founder Badge Styling

**Co-Founder badges use brand secondary colors:** Co-Founder badges and emphasis should use secondary brand colors (`bg-secondary-400` with `text-secondary-900`) to maintain brand consistency and differentiate from other accent elements.

### Examples

```svelte
<!-- ✅ Correct: Light bg with dark text -->
<div class="bg-accent-50">
  <p class="text-accent-900">Text on light yellow</p>
</div>

<!-- ✅ Correct: Dark bg with light text -->
<div class="bg-primary-800">
  <p class="text-primary-100">Text on dark navy</p>
</div>

<!-- ❌ Wrong: Insufficient contrast -->
<div class="bg-accent-50">
  <p class="text-accent-500">Text too light on light bg</p>
</div>
```

## Component Development

### Magazine-Style Introductions

**Create engaging, varied layouts:** When introducing new concepts or sections, use magazine-style layouts with:

- **Varied visual sections**: Mix cards, gradient backgrounds, split layouts, and centered emphasis
- **Progressive disclosure**: Build narrative flow as users scroll, revealing information in stages
- **Visual hierarchy**: Use different styling approaches (borders, shadows, gradients, badges) to create visual interest
- **Surprise elements**: Include unexpected visual treatments (rotated elements, colored badges, split layouts) to maintain engagement
- **Purposeful variety**: Each section should feel distinct yet cohesive, avoiding monotonous "text box" layouts

**Example approach:**

- Start with a centered title and introduction
- Follow with a split layout or card-based section
- Add emphasis with gradient backgrounds or colored badges
- Conclude with a powerful statement or call-to-action

### Best Practices

1. **Use Tailwind utility classes** instead of custom CSS when possible
2. **Leverage design system components** (Card, Button, etc.) before creating new ones
3. **Follow responsive patterns**: `text-base md:text-lg lg:text-xl`
4. **Use semantic color tokens**: `text-primary-500`, `bg-secondary-50`, etc.
5. **Maintain consistent spacing**: Use Tailwind spacing scale (mb-4, p-8, etc.)
6. **Create engaging layouts**: Avoid monotonous sections—use varied styling to maintain reader interest

### Component Creation Checklist

- [ ] Check if existing component can be reused or extended
- [ ] Follow atomic design hierarchy (atom → molecule → organism)
- [ ] Use Tailwind utilities for styling
- [ ] Ensure proper color contrast (dark text on light bg, light text on dark bg)
- [ ] Make it responsive with breakpoint variants
- [ ] Export from appropriate index file
- [ ] Document component usage

## File Organization

### Component Location Rules

- **Atoms**: Basic UI elements (Button, Icon, Input)
- **Molecules**: Simple combinations (Card, FormField, PageHeader)
- **Organisms**: Complex sections (Hero, Navigation, Footer)
- **Feature-specific**: Keep in `src/lib/components/` if not part of core design system

### Import Patterns

```javascript
// ✅ Prefer design system imports
import { Button, Card } from "$lib/design-system";

// ✅ Use named exports from index files
import { HominioIdentity } from "$lib/design-system/molecules";
```

## Responsive Design

### Breakpoint Strategy

- Use Tailwind's default breakpoints: `sm`, `md`, `lg`, `xl`
- Mobile-first approach: Base styles for mobile, add `md:` and `lg:` variants
- Test on multiple screen sizes

### Common Patterns

```svelte
<!-- Typography -->
<h1 class="text-2xl md:text-4xl lg:text-5xl">Title</h1>

<!-- Spacing -->
<div class="p-4 md:p-8 lg:p-12">Content</div>

<!-- Layout -->
<div class="flex flex-col md:flex-row">Layout</div>
```

## Maintenance

### Regular Reviews

- Audit components for reusability
- Refactor duplicated code into shared components
- Update design tokens as brand evolves
- Ensure all components follow contrast guidelines
- Keep design system documentation up to date

### Code Quality

- Consistent naming conventions
- Clear component props/types
- Proper TypeScript types where applicable
- Accessible markup (semantic HTML, ARIA where needed)
