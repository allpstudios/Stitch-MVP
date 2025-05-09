import React, { useEffect, useState, useRef } from 'react';
import { restoreToBeta, isBetaMode } from '../config/projectState';
import './CommandHandler.css';

const CommandHandler = () => {
  const [command, setCommand] = useState('');
  const [showCommandInput, setShowCommandInput] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  // Function to handle the restore command
  const handleRestoreCommand = () => {
    console.log('Attempting to restore to beta mode...');
    console.log('Current command:', command);
    
    if (command.toUpperCase() === 'RESTORE TO BETA') {
      console.log('Command matches! Restoring to beta mode...');
      restoreToBeta();
      setMessage('Restoring to beta mode...');
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.log('Command does not match. Expected: RESTORE TO BETA, Got:', command);
      setMessage('Command not recognized. Try "RESTORE TO BETA"');
      setCommand('');
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle command input with Ctrl+Shift+B
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        setShowCommandInput(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus the input when it becomes visible
  useEffect(() => {
    if (showCommandInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCommandInput]);

  // If command input is not visible, don't render anything
  if (!showCommandInput) {
    return null;
  }

  return (
    <div className="command-input-container">
      <div className="command-input">
        <span className="command-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleRestoreCommand();
            }
          }}
          className="command-text-input"
          placeholder="Type command..."
          autoFocus
        />
      </div>
      <div className="command-help">
        Type "RESTORE TO BETA" and press Enter to restore all features
      </div>
      {message && <div className="command-message">{message}</div>}
    </div>
  );
};

export default CommandHandler; 