# The Chaos Engine

An open-source ECS game engine written in typescript.

## DOCS IN PROGRESS
With the API reaching moderate stability, The next few releases will focus 
exclusively on building up documentation and tutorials on using the engine.

## How it feels

```typescript
import {
  Entity,
  Intention,
  Plugins,
  RealEntity,
  ReservedKeys,
  ReservedStages,
  System,
  Util,
  World,
} from '@persephia/chaos-engine';

// Some type definitions
type Vec2 = {x: number; y: number};
type Position = Vec2;
type Velocity = Vec2;

function addVec2s(a: Vec2, b: Vec2): Vec2 {
  // ...
}

// Our key constants
const KEYS = {
  POSITION: 'position',
  VELOCITY: 'velocity',
} as const;

// Some system definitions
const addPlayer: System = async world => {
  const playerBundle = {
    position: {x: 0, y: 0},
    velocity: {x: 1, y: 1},
  }
  return new Intention().addBundle(playerBundle);
};

const updatePositions: System = async world => {
  // Gets all components in our world with both position and velocity
  const components = world.query<[number, Position, Velocity]>([
    ReservedKeys.ID,
    Keys.POSITION,
    Keys.VELOCITY,
  ]);

  // Specify WHAT updates should happen, but not HOW the world performs them.
  const intention = new Intention();
  for (const [id, position, velocity] of components) {
    const nextPosition =  addVec2s(position, velocity);
    intention.setComponent(Keys.POSITION, nextPosition, id);
  }

  return intention;
}

// Add your systems to the world
export const playGame = async () => {
  const world = new World()
    .addPlugin(Plugins.corePlugin)
    // Systems can be added independently, with an optional specified stage.
    .addSystem(addPlayer, ReservedStages.START_UP)
    .addSystem(updatePositions) // No supplied stage means run on every UPDATE stage.

  return world.play();
};

```

