# Snake Tutorial
One of the best ways to get familiar with a framework is to jump right in, so in this 
tutorial we'll be building a cut-down version of snake.

You can find the finished version of this tutorial [here](https://github.com/harrykeightley/snake).

## Goals
After this tutorial, hopefully you should be comfortable:
1. Setting up a chaos project
2. Identifying how to use the appropriate data types to model game state
3. Using systems to model game behaviour

## Setting up our project with vite
First let's let vite templates do some setup-heavy-lifting for us.
Open up a new terminal and start a new vite project with typescript:

`npm create vite@latest snake -- --template vanilla-ts`

Then:

```sh
cd snake
npm i
npm run dev
```

This should open up at dev server at a port listed in your terminal (e.g. localhost:5173).
If you visit that url in your browser, you should see something like the following:

![vite-starter](/snake/vite-starter.png)

### Hows this all working so far?
Let's build some intuition for how vite is running anything so far.
First of all, open the root `index.html` file:

![vite-starter-html](/snake/starter-html.png)

This is what we're opening when we go to the url listed by the dev server. You can see we have 
a single `<div id='app'>` in the body, which the script loaded from `src/main.ts` modifies to 
show some basic content.

Let's make our starter even simpler...

1. From the `src` directory, delete `counter.ts`, `styles.css` and `typescript.svg`.
2. Delete the entire contents of `src/main.ts`

Your directory should now look like this:

![vite-starter-post-deletion](/snake/starter-post-deletion.png)

Now we're ready to add our own code.

## Installing chaos-engine. 

Lets install our dependencies for this project:

`npm i @persephia/chaos-engine pixi.js`


