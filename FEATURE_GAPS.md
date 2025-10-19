# CollabCanvas Feature Gaps Analysis

**Date**: 2025-10-19  
**Purpose**: Prioritized list of missing features for rubric optimization  
**Current Estimate**: 82-86/100 points (Good tier)  
**Target**: 90+ points (Excellent tier)

---

## Executive Summary

Based on comprehensive rubric audit and codebase analysis, this document identifies:
- **Critical gaps** preventing Good tier achievement (none found - we're at Good!)
- **High-value features** for reaching Excellent tier (90+)
- **Quick wins** for easy point gains
- **Implementation complexity** estimates

### Quick Stats

**Missing Features by Category**:
- Tier 1 Advanced Features: 1-2 missing (2-4 points)
- Tier 2 Advanced Features: 6 missing (18 points potential, need 1-2 = 3-6 points)
- Performance validation: Scale testing not done (potential 2-5 point loss)
- Documentation polish: Minor gaps (0-1 point loss)

**Best ROI Features** (High points, moderate effort):
1. ✨ Alignment Tools (Tier 2) - 3 points, ~6 hours
2. ✨ Z-index Management (Tier 2) - 3 points, ~4 hours
3. ✨ Export PNG/SVG (Tier 1) - 2 points, ~4 hours
4. ✨ Performance Test at 300+ objects - validates existing points

---

## Critical Gaps (Blocking Good Tier 80-89)

### None Found ✅

All requirements for Good tier (80-89 points) are met or nearly met:
- ✅ Core collaborative infrastructure: 24-26/30
- ✅ Canvas features: 14-17/20 
- ✅ Advanced features: 10-11/15 (Good tier requirement: 10-12)
- ✅ AI agent: 21-24/25
- ✅ Technical implementation: 9/10
- ✅ Documentation: 4/5

**Total**: 82-86 points (Good tier secured)

---

## High-Value Features (Excellent Tier 90+)

These features provide the best return on investment for reaching Excellent tier.

---

### 1. Alignment Tools (Tier 2) ⭐⭐⭐

**Points**: 3 points  
**Current Status**: Not implemented  
**Complexity**: Medium (~6 hours)  
**Priority**: HIGH - Best ROI for reaching Excellent

#### Description
Professional layout tools for aligning and distributing shapes.

#### Requirements
- **Horizontal Alignment**: left, center, right
- **Vertical Alignment**: top, middle, bottom
- **Distribution**: Evenly space shapes horizontally or vertically
- **Multi-select Support**: Works on 2+ selected shapes
- **Relative Alignment**: Align to bounding box of selection
- **AI Integration**: "align these shapes to the left"

#### Implementation Notes
- Add alignment buttons to toolbar (or context menu)
- Calculate bounding box of selected shapes
- Compute new positions based on alignment mode
- Apply transformations atomically (single Yjs transaction)
- Sync to all users immediately

**Functions to Implement**:
```typescript
// In shapes/alignment.ts (new file)
function alignLeft(shapes: Shape[]): Shape[]
function alignCenter(shapes: Shape[]): Shape[]
function alignRight(shapes: Shape[]): Shape[]
function alignTop(shapes: Shape[]): Shape[]
function alignMiddle(shapes: Shape[]): Shape[]
function alignBottom(shapes: Shape[]): Shape[]
function distributeHorizontally(shapes: Shape[], spacing: number): Shape[]
function distributeVertically(shapes: Shape[], spacing: number): Shape[]
```

#### UI Changes
- Add alignment toolbar section (or dropdown)
- Icons for each alignment type
- Keyboard shortcuts: Cmd+Shift+L (left), Cmd+Shift+C (center), etc.
- Disabled when <2 shapes selected

#### Testing
- E2E: Align 3 shapes left → all left edges aligned
- E2E: Distribute 4 shapes horizontally → even spacing
- E2E: Multi-user: User A aligns, User B sees result

#### Effort Breakdown
- Implementation: 4 hours
- UI/toolbar integration: 1 hour
- Testing: 1 hour
- **Total**: ~6 hours

---

### 2. Z-Index Management (Tier 2) ⭐⭐⭐

**Points**: 3 points  
**Current Status**: Not implemented  
**Complexity**: Medium (~4 hours)  
**Priority**: HIGH - Easy implementation, high value

#### Description
Control rendering order of shapes (bring to front, send to back).

#### Requirements
- **Bring to Front**: Cmd+]
- **Send to Back**: Cmd+[
- **Bring Forward**: Cmd+Shift+]
- **Send Backward**: Cmd+Shift+[
- **Visual Feedback**: Show z-index in layers panel (if implemented)
- **Multi-select**: Maintain relative z-order when moving group

#### Implementation Notes
- Add `zIndex: number` property to all shapes (default: 0)
- Update `ShapeLayer.tsx` to sort shapes by zIndex before rendering
- Konva respects render order, so sorting before `<Group>` is sufficient
- When changing z-index, reassign values to create gaps (0, 100, 200, etc.)

**Functions to Implement**:
```typescript
// In shapes/zindex.ts (new file)
function bringToFront(shapeId: string, shapes: Shape[]): Shape[]
function sendToBack(shapeId: string, shapes: Shape[]): Shape[]
function bringForward(shapeId: string, shapes: Shape[]): Shape[]
function sendBackward(shapeId: string, shapes: Shape[]): Shape[]
```

#### UI Changes
- Add z-index buttons to toolbar (4 buttons or 1 dropdown)
- Keyboard shortcuts as above
- Right-click context menu (optional)
- Disabled when no selection

#### Testing
- E2E: Create 3 overlapping shapes, send back → order changes
- E2E: Bring to front → shape renders on top
- E2E: Multi-user: User A changes z-index, User B sees update

#### Effort Breakdown
- Add zIndex property to shape types: 0.5 hour
- Implement z-index functions: 1 hour
- Update rendering to respect zIndex: 1 hour
- UI integration: 1 hour
- Testing: 0.5 hour
- **Total**: ~4 hours

---

### 3. Layers Panel (Tier 2) ⭐⭐

**Points**: 3 points  
**Current Status**: Not implemented  
**Complexity**: Large (~8 hours)  
**Priority**: MEDIUM - High value but more complex

#### Description
Sidebar showing all shapes in a hierarchical list with management controls.

#### Requirements
- **List All Shapes**: Show type icon, name/ID, thumbnail (optional)
- **Click to Select**: Clicking entry selects shape on canvas
- **Drag to Reorder**: Updates z-index
- **Visibility Toggle**: Eye icon to show/hide shapes
- **Lock Toggle**: Lock icon to prevent editing
- **Sync State**: Visibility and lock state sync via Yjs

#### Implementation Notes
- New component: `LayerPanel.tsx`
- Add to shape properties: `visible: boolean`, `locked: boolean`
- Update `ShapeLayer.tsx` to respect visibility (don't render if false)
- Update locking logic to also check `locked` property (in addition to selection locks)
- Panel can be collapsible sidebar or floating panel

**UI Structure**:
```
LayersPanel
├─ Header ("Layers")
├─ ShapeList (scrollable)
│  ├─ ShapeEntry (for each shape)
│  │  ├─ Icon (shape type)
│  │  ├─ Name (editable text)
│  │  ├─ VisibilityToggle (eye icon)
│  │  └─ LockToggle (lock icon)
└─ Footer (optional: count, filter)
```

#### Testing
- E2E: Create 3 shapes, all appear in layers panel
- E2E: Click layer entry → selects on canvas
- E2E: Hide shape → disappears from canvas, still in panel
- E2E: Lock shape → other users can't select
- E2E: Drag to reorder → z-index updates

#### Effort Breakdown
- LayerPanel component: 3 hours
- Visibility/lock properties: 1 hour
- Drag-to-reorder logic: 2 hours
- Testing: 2 hours
- **Total**: ~8 hours

---

### 4. Export Canvas as PNG/SVG (Tier 1) ⭐⭐

**Points**: 2 points  
**Current Status**: Not implemented  
**Complexity**: Medium (~4 hours)  
**Priority**: MEDIUM - Useful feature, moderate effort

#### Description
Export entire canvas or selected shapes to image files.

#### Requirements
- **Export Formats**: PNG and SVG
- **Export Options**: 
  - Entire canvas
  - Selected shapes only
  - Visible area (viewport)
- **Quality Settings**: Configurable resolution/scale
- **UI**: Export button with modal for options

#### Implementation Notes
- Konva provides built-in export: `stage.toDataURL()` (PNG) and `stage.toSVG()` (SVG)
- Export selected shapes: Create temporary Konva stage with only selected shapes
- Download file: Use browser download API

**API Usage**:
```typescript
// PNG export
const dataURL = stage.toDataURL({ pixelRatio: 2 }); // 2x resolution
// Trigger download
const link = document.createElement('a');
link.download = 'canvas.png';
link.href = dataURL;
link.click();

// SVG export (requires konva-svg plugin)
const svg = stage.toSVG();
// Trigger download as .svg file
```

#### UI Changes
- Add "Export" button to toolbar
- Export modal with options:
  - Format: PNG / SVG (radio buttons)
  - Scope: Canvas / Selection / Visible area
  - Resolution: 1x / 2x / 4x (PNG only)
  - Filename input
- Show preview thumbnail (optional)

#### Testing
- E2E: Export canvas as PNG → file downloads
- E2E: Export selected shapes → only those shapes in file
- E2E: Try both PNG and SVG formats

#### Effort Breakdown
- Export functions: 1.5 hours
- Export modal UI: 1.5 hours
- File download handling: 0.5 hour
- Testing: 0.5 hour
- **Total**: ~4 hours

---

### 5. Snap-to-Grid / Smart Guides (Tier 1) ⭐

**Points**: 2 points  
**Current Status**: Grid rendering exists, no snapping  
**Complexity**: Medium (~5 hours)  
**Priority**: LOW-MEDIUM - Nice to have, moderate complexity

#### Description
Visual guides and magnetic snapping to help precise positioning.

#### Requirements
- **Snap-to-Grid**: Toggle on/off, configurable grid size
- **Smart Guides**: Show alignment lines when dragging (Figma-style)
  - Align to other shapes' edges
  - Align to canvas center
  - Show distance measurements
- **Magnetic Snapping**: Shape "snaps" to guide lines within threshold

#### Implementation Notes
- Grid already rendered (Canvas.tsx)
- Snap-to-grid: Round x, y to nearest grid increment during drag
- Smart guides: Detect when shape edge aligns with other shapes' edges
- Render temporary guide lines (Konva.Line with dash pattern)

**Snapping Logic**:
```typescript
function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

function findAlignmentGuides(shape: Shape, allShapes: Shape[]): Guide[] {
  // Compare edges of dragging shape to all other shapes
  // Return array of guides when within snap threshold (5px)
}
```

#### UI Changes
- Toggle button: "Snap to Grid" (checkmark when enabled)
- Grid size picker: 10px / 20px / 50px (dropdown)
- Guide lines render on canvas (transparent lines)
- Distance labels (optional, Figma-style)

#### Testing
- E2E: Enable snap-to-grid → drag shape → position is grid-aligned
- E2E: Drag near another shape → guide line appears
- E2E: Multi-user: User A drags, User B sees smooth movement (guides don't interfere)

#### Effort Breakdown
- Snap-to-grid logic: 1 hour
- Smart guides detection: 2 hours
- Guide rendering: 1 hour
- UI toggle: 0.5 hour
- Testing: 0.5 hour
- **Total**: ~5 hours

---

### 6. Object Grouping (Tier 1) ⭐

**Points**: 2 points  
**Current Status**: Not implemented  
**Complexity**: Large (~8 hours)  
**Priority**: LOW - Complex implementation for 2 points

#### Description
Group multiple shapes to move/transform as a single unit.

#### Requirements
- **Create Group**: Cmd+G with multiple shapes selected
- **Ungroup**: Cmd+Shift+G
- **Nested Groups**: Groups can contain other groups
- **Transform**: Moving/resizing group affects all members
- **Visual Indicator**: Grouped shapes show bounding box
- **AI Support**: "Create a grouped login form"

#### Implementation Notes
- Add `groupId?: string` property to shapes
- When creating group: Assign same groupId to all selected shapes
- Ungrouping: Remove groupId property
- Transforms: When dragging grouped shape, move all shapes with same groupId
- Nested groups: Groups can have parent groupId

**Data Structure**:
```typescript
type Shape = BaseShape & {
  groupId?: string; // ID of group this shape belongs to
  isGroupRoot?: boolean; // True for the "primary" shape in group
};
```

**Alternative**: Create separate `Group` entity that contains shape IDs

#### Challenges
- Yjs synchronization of group relationships
- Undo/redo support (ungroup operation)
- Selection behavior (select one shape in group = select all?)
- Locking (lock group = lock all members?)

#### UI Changes
- Group/Ungroup buttons in toolbar
- Keyboard shortcuts: Cmd+G, Cmd+Shift+G
- Visual: Dashed bounding box around grouped shapes
- Layers panel: Show group hierarchy (if layers panel implemented)

#### Testing
- E2E: Select 3 shapes, press Cmd+G → group created
- E2E: Drag grouped shape → all members move together
- E2E: Cmd+Shift+G → ungroup
- E2E: Nested groups: Group 2 shapes, group that with 1 more

#### Effort Breakdown
- Group data model: 1 hour
- Group creation/removal: 2 hours
- Transform behavior for groups: 2 hours
- Visual feedback: 1 hour
- Undo/redo support: 1 hour
- Testing: 1 hour
- **Total**: ~8 hours

---

## Performance & Testing Gaps

These aren't missing features but validation gaps that could cost points.

---

### 7. Performance Testing at Scale ⚠️

**Points at Risk**: 2-5 points (could drop from Excellent to Good)  
**Current Status**: Not tested at 300+ or 500+ objects  
**Complexity**: Low (testing only)  
**Priority**: CRITICAL - Needed to validate current score

#### What's Missing
- No automated tests with 300+ objects (Good tier requirement)
- No automated tests with 500+ objects (Excellent tier requirement)
- No FPS measurement during operations
- No 5+ concurrent user tests

#### Current State
- Architecture supports scale (Konva, Yjs, throttling)
- Manual testing shows good performance up to 35 shapes
- Theoretical capacity much higher

#### Testing Plan
1. **Create performance test suite**: `performance.spec.ts` ✅ (already created!)
2. **Test scenarios**:
   - 100 objects: Rapid operations responsive
   - 300 objects: Good tier validation
   - 500 objects: Excellent tier validation
   - 5 users: Concurrent editing without lag
3. **Measure**: FPS, response times, memory usage

#### Risks
- If performance doesn't meet targets, optimization needed
- Konva may need viewport culling for 500+ objects
- Browser rendering may be bottleneck

#### Recommendations
1. **Run existing performance tests** (in `performance.spec.ts`)
2. **If tests fail**:
   - Implement viewport culling (only render visible shapes)
   - Add Konva layer caching
   - Optimize shape rendering
3. **Document results** in ARCHITECTURE.md

**Effort**: 2-4 hours (running tests + optimizations if needed)

---

### 8. E2E Test Coverage Expansion ✅

**Points at Risk**: 0-2 points (validation confidence)  
**Current Status**: Comprehensive test suites created  
**Complexity**: Low (tests already written)  
**Priority**: MEDIUM - Validates claimed points

#### Already Created ✅
- `multi-select.spec.ts` - Multi-select and group operations (15 tests)
- `undo-redo.spec.ts` - Undo/redo functionality (18 tests)
- `performance.spec.ts` - Performance and scalability (13 tests)
- `conflict-resolution.spec.ts` - All 4 rubric scenarios (12 tests)
- `persistence.spec.ts` - All 4 rubric scenarios (16 tests)

**Total**: 74 new tests added

#### Next Steps
1. **Run all tests**: `npm run test:e2e`
2. **Fix any failures**: Debug and resolve issues
3. **Update skipped tests**: Document why skipped or implement

**Effort**: 2-4 hours (running tests, fixing failures)

---

## Documentation Gaps

Minor gaps that could cost 0-1 points.

---

### 9. README Polish for Submission ⚠️

**Points at Risk**: 0-1 point  
**Current Status**: Needs submission-ready polish  
**Complexity**: Low (~30 min)  
**Priority**: HIGH - Required for submission

#### Missing Elements
- Live demo link prominently displayed (ensure it works!)
- Feature showcase with checkmarks
- Screenshot or GIF of real-time collaboration
- AI command examples
- Links to demo video (TBD)
- Links to AI development log (TBD)

#### Template Structure
```markdown
# CollabCanvas - Real-Time Collaborative Canvas with AI

[Live Demo](https://canvas.adamwhite.work) | [Demo Video](#) | [AI Dev Log](#)

![Screenshot](./assets/screenshot.png)

## Features ✨
✅ Real-time multi-user collaboration
✅ AI canvas agent with natural language commands
✅ Multi-select with lasso selection
✅ Undo/redo with Yjs history
✅ Conflict-free editing with locks
✅ [... all implemented features]

## Quick Start
1. Clone repo
2. Install dependencies: `npm install`
3. Set up Clerk: [instructions]
4. Run dev server: `npm run dev`
5. Open in 2 browsers to test collaboration

## Tech Stack
- Frontend: React + Konva + Yjs
- Backend: Cloudflare Workers + Durable Objects
- AI: Workers AI / OpenAI
- Auth: Clerk

## Architecture
See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

[... rest of README]
```

**Effort**: 30 minutes

---

### 10. AI Development Log (Pass/Fail) ⚠️

**Points at Risk**: -10 if not submitted  
**Current Status**: NOT CREATED  
**Complexity**: Low (~30 min)  
**Priority**: CRITICAL - Required, -10 penalty if missing

#### Requirements
Need 3 of 5 sections:
1. Tools & Workflow used
2. 3-5 effective prompting strategies
3. Code analysis (% AI vs hand-written)
4. Strengths & limitations
5. Key learnings

#### Recommended Sections
Choose 3:
- **Section 1**: Tools (Cursor AI, Claude, GitHub Copilot)
- **Section 2**: Prompting strategies with examples
- **Section 4**: Strengths & limitations (specific examples)

**Effort**: 30 minutes

---

### 11. Demo Video (Pass/Fail) ⚠️

**Points at Risk**: -10 if not submitted  
**Current Status**: NOT CREATED  
**Complexity**: Medium (~1 hour)  
**Priority**: CRITICAL - Required, -10 penalty if missing

#### Requirements
- 3-5 minutes
- 2+ users collaborating (side-by-side screens)
- Multiple AI commands demonstrated
- Advanced features shown
- Architecture explanation

#### Recording Plan
1. **Prep**: Open 2 browser windows, sign in to both
2. **Record**: Use OBS or Loom
3. **Script**:
   - Intro: "CollabCanvas - real-time collaborative canvas"
   - Demo: Show cursor presence, shape creation, locking
   - AI Demo: "Create a login form", "Arrange these shapes"
   - Advanced: Multi-select, undo/redo, conflict resolution
   - Architecture: Quick diagram explanation
4. **Edit**: Add title cards, trim
5. **Upload**: YouTube (unlisted) or Loom
6. **Link**: Update README

**Effort**: 1 hour (recording + editing)

---

## Priority Matrix

| Feature | Points | Effort | Priority | Reason |
|---------|--------|--------|----------|--------|
| **CRITICAL** |
| AI Dev Log | PASS/FAIL (-10) | 30 min | ⚠️ CRITICAL | Required, severe penalty |
| Demo Video | PASS/FAIL (-10) | 1 hour | ⚠️ CRITICAL | Required, severe penalty |
| README Polish | 0-1 | 30 min | HIGH | Quick win, submission requirement |
| Performance Tests | 2-5 | 2-4 hours | HIGH | Validates current score |
| **HIGH VALUE** |
| Alignment Tools (T2) | 3 | 6 hours | HIGH | Best ROI for Excellent |
| Z-Index (T2) | 3 | 4 hours | HIGH | Easy implementation |
| **MEDIUM VALUE** |
| Layers Panel (T2) | 3 | 8 hours | MEDIUM | High value but complex |
| Export PNG/SVG (T1) | 2 | 4 hours | MEDIUM | Useful, moderate effort |
| **LOW VALUE** |
| Snap-to-Grid (T1) | 2 | 5 hours | LOW-MEDIUM | Nice to have |
| Grouping (T1) | 2 | 8 hours | LOW | Complex for 2 points |

---

## Recommended Implementation Order

### Phase 1: Critical (Must Do - 2.5 hours)
1. ✅ Create AI Development Log (30 min)
2. ✅ Record Demo Video (1 hour)
3. ✅ Polish README (30 min)
4. ✅ Run performance tests (30 min)

**Impact**: Avoids -20 point penalty, validates current 82-86 score

---

### Phase 2: Quick Wins for Excellent (10 hours)
1. ✅ Add Z-Index Management (4 hours) → +3 points
2. ✅ Add Alignment Tools (6 hours) → +3 points

**Impact**: 82-86 + 6 = **88-92 points** (Excellent threshold reached!)

---

### Phase 3: Stretch Goals (8-13 hours)
1. ✅ Add Layers Panel (8 hours) → +3 points
2. ✅ Add Export PNG/SVG (4 hours) → +2 points
3. ⚠️ Add Snap-to-Grid (5 hours) → +2 points (if time permits)

**Impact**: 88-92 + 5-7 = **93-99 points** (Solid Excellent tier)

---

## Estimated Final Scores

### Conservative Path (Phase 1 only)
- Complete Pass/Fail requirements
- Run performance tests (assume passing)
- **Estimated**: 82-86 points (Good tier secured)

### Realistic Path (Phase 1 + 2)
- Add Z-index and Alignment (Tier 2 features)
- **Estimated**: 88-92 points (Excellent tier!)

### Ambitious Path (Phase 1 + 2 + 3)
- Add all Tier 2 features + some Tier 1
- **Estimated**: 93-99 points (Strong Excellent)

---

## Feature Implementation Checklist

### Tier 1 Features Status
- [x] Color picker with recent colors ✅
- [x] Undo/redo with shortcuts ✅
- [x] Comprehensive keyboard shortcuts ✅
- [ ] Export PNG/SVG ❌
- [ ] Snap-to-grid / smart guides ❌
- [ ] Object grouping ❌
- [x] Copy/paste ✅

**Implemented**: 4/7 (max 6 points awarded, need 3)  
**Available**: 3 more for extra points (6 points max total)

### Tier 2 Features Status
- [ ] Component system ❌
- [ ] Layers panel ❌
- [ ] Alignment tools ❌
- [ ] Z-index management ❌
- [x] Lasso selection ✅
- [ ] Styles/design tokens ❌
- [ ] Canvas frames/artboards ❌

**Implemented**: 1/7 (3 points)  
**Need for Excellent**: 1-2 more (3-6 additional points)

### Tier 3 Features Status
- [ ] All 7 features ❌

**Implemented**: 0/7  
**Not required for Excellent** (bonus points only)

---

## Key Insights

### What's Working Well
1. ✅ AI agent implementation is excellent (21-24/25)
2. ✅ Core collaboration infrastructure is solid (24-26/30)
3. ✅ Technical architecture is clean and scalable (9/10)
4. ✅ Have most Tier 1 features (4-5 of 7)

### Critical Success Factors
1. ⚠️ **Must complete Pass/Fail requirements** (AI log, video)
2. ⚠️ **Must validate performance** at scale
3. ✨ **Need 1-2 more Tier 2 features** for Excellent

### Low-Hanging Fruit
1. Z-index management - Easy implementation, 3 points
2. Alignment tools - Moderate implementation, 3 points
3. Export - Moderate implementation, 2 points

### Diminishing Returns
- Grouping: 8 hours for 2 points
- Snap-to-grid: 5 hours for 2 points
- Tier 3 features: Very complex, diminishing returns

---

## Conclusion

**Current Standing**: 82-86 points (Good tier)  
**Realistic Target**: 88-92 points (Excellent tier) with 10-16 hours work  
**Stretch Target**: 93-99 points with 18-29 hours work

**Recommended Focus**:
1. Complete Pass/Fail (2.5 hours) - **CRITICAL**
2. Add Z-index + Alignment (10 hours) - **HIGH ROI**
3. Consider Layers Panel or Export if time permits

**Key Principle**: Don't let perfect be the enemy of good. Reaching Excellent (90+) is achievable with focused effort on high-value features.

---

**Next Steps**: See `RUBRIC_AUDIT.md` for detailed current implementation analysis  
**Test Plan**: Run `npm run test:e2e` to validate new test coverage  
**Commit Strategy**: Organize PRs by feature, keep working state

