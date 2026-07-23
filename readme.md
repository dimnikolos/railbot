# Railbot 🚂

> A visual, track-building programming game for early learners (Ages 5-7).

[![Play Web Demo](https://img.shields.io/badge/Play-Web_Demo-success)](#) *(https://dimnikolos.github.io/railbot)*

## 📖 Overview
**Railbot** reimagines block-based coding for young children. Instead of using abstract directional arrows on a pre-built maze, children program a train using literal track pieces. As the train executes the sequence, it dynamically lays down the tracks in real-time.

## ✨ Core Mechanics
* **Track-Based Commands:** Programming blocks are the actual tracks ('Straight', 'Turn Left', 'Turn Right').
* **Ego-Centric Navigation:** Turns are calculated from the train's perspective, teaching mental rotation and spatial awareness.
* **Visual Execution:** The code becomes the physical path. The train builds the grid route based on the queue.
* **Interactive Timeline & Single Command Delete:** Players can click on any executed command in the queue to instantly simulate and jump to that exact state in time (scrubbing), making debugging intuitive and visual. A toggleable setting allows deleting individual commands for granular editing without starting over.
* **In-Game Level Builder:** An intuitive visual grid editor allows players and educators to design custom levels directly in the browser. These levels are saved locally and can include stations and obstacles (boulders).
* **Advanced Mode (Blockly Integration):** A dedicated 8x8 grid mode that transitions kids to real programming concepts using Blockly puzzles. Supports `for` loops and custom action blocks like sounding the train whistle.
* **Objective:** Navigate the grid and connect the path to various train stations.

## 🎨 Design & Immersion
* **Clean UI:** Glassmorphism and minimalist grid lines prevent visual clutter, focusing attention on the puzzle.
* **Audio Feedback:** Authentic train chugging and whistling sounds respond to the player's code execution.

## 🧠 Educational Value
Tailored specifically for the cognitive load of Kindergarten and 1st-grade students:
* **Algorithmic Sequencing:** Encourages planning a logical sequence of steps before execution.
* **Spatial Orientation:** Transitions learners from an external viewpoint to an ego-centric perspective.
* **Self-Correction & Debugging:** Clear grid boundaries and an interactive timeline provide immediate, non-punitive feedback.

## 🚀 Getting Started

### Running Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/dimnikolos/railbot.git
   ```
2. Simply open `index.html` in your browser. No build steps required!