# Chess

This project is a web-based chess application focused on **studying and exploring chess openings and move trees** rather than only playing full games.

The site allows users to visualise chess positions, follow predefined opening lines, and interact with branching move paths. As moves are selected, the board updates dynamically to reflect the current position, enabling users to understand how different choices affect the game state.

A core concept of the project is treating chess openings as **structured trees**, where:
- Each node represents a move
- Each branch represents a possible continuation
- Selecting a move filters and narrows the available lines that follow

This makes the site well-suited for opening preparation, repetition-based study, and understanding common responses within an opening rather than memorising full PGNs.

The project is designed to be modular and extensible, with the long-term goal of supporting features such as:
- Opening repertoires
- Line filtering and refinement
- Position previews based on selected move paths
- Repeated study of chosen variations
