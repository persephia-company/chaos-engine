# @persephia/chaos-engine

## 0.2.4

### Patch Changes

- a180c14: Allow users to specify that other stages should run before update.
- ac0f99c: Move reserved keys and stages into their own lib file.

## 0.2.3

### Patch Changes

- 2441dd8: Refactor of World and core plugins

## 0.2.2

### Patch Changes

- 7e5ee4d: QOL Changes

  - process.env isn't required to be available for logging.
  - Adding bundles doesn't screw up the world.
  - Add extra method on Intention to differentiate between
    updating one component id and updating all components

- e90b3c8: Allow for pinot logger to run without explicit dependency on process.env (for vite environments)

## 0.2.1

### Patch Changes

- a7376ad: Add exports for /lib/entity

## 0.2.0

### Minor Changes

- 0c1e7ef: Breaking change to core API for SystemResults and SystemChanges

## 0.1.1

### Patch Changes

- d29743b: Lessen api requirements

## 0.1.0

### Minor Changes

- 0e6aa79: All systems, as well as step, apply_stage and apply_system have been made asynchronous

## 0.0.11

### Patch Changes

- 555ff6b: Fix many issues related to ids and generated change events.

## 0.0.10

### Patch Changes

- 044d3bf: Fix vulnerabilities and properly export built-in Stages and Keys

## 0.0.9

### Patch Changes

- 25f7ab0: Fixed issues with ambiguous exports of Reserved Stages.
  Added ability to add bundles to system results.

## 0.0.8

### Patch Changes

- 2718739: Fix bug which made world.set call add instead of set.

## 0.0.7

### Patch Changes

- 81cf879: Fix some essential errors around id allocation and improve error logging in store updates.

## 0.0.6

### Patch Changes

- 61d83e7: - Fixed bug where each stage's systems would run thrice.
  - Fixed bug where events might reset before changeEvents are added.

## 0.0.5

### Patch Changes

- 37d0edf: Fix system naming issues and stage application bugs.

## 0.0.4

### Patch Changes

- 44a0c1e: Properly export requireEvents

## 0.0.3

### Patch Changes

- 6a214cc: Fixed issues using the Updateable API on the world (ramda disliking classes)

## 0.0.2

### Patch Changes

- 9f73eb7: Initial changeset
