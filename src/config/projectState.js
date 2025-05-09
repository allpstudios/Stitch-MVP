// Project state configuration
// This file tracks whether the project is in alpha or beta mode
// and provides functions to switch between them

// Default to alpha mode
let projectMode = localStorage.getItem('projectMode') || 'alpha';

// Function to get the current project mode
export const getProjectMode = () => {
  return projectMode;
};

// Function to set the project mode
export const setProjectMode = (mode) => {
  if (mode === 'alpha' || mode === 'beta') {
    projectMode = mode;
    // Save to localStorage to persist across page reloads
    localStorage.setItem('projectMode', mode);
    console.log(`Project mode set to: ${mode}`);
    return true;
  }
  return false;
};

// Function to check if we're in alpha mode
export const isAlphaMode = () => {
  return projectMode === 'alpha';
};

// Function to check if we're in beta mode
export const isBetaMode = () => {
  return projectMode === 'beta';
};

// Function to restore to beta mode
export const restoreToBeta = () => {
  setProjectMode('beta');
  console.log('Project restored to beta mode with all features enabled');
  return true;
};

// Function to switch to alpha mode
export const switchToAlpha = () => {
  setProjectMode('alpha');
  console.log('Project switched to alpha mode with limited features');
  return true;
}; 