"use client";

import React, { useEffect, useState } from "react";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";

interface Props {
  remoteElements?: readonly any[];
  onChange?: (elements: readonly any[], appState: any) => void;
}

export default function CustomExcalidraw({ remoteElements, onChange }: Props) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  const isUpdatingRef = React.useRef(false);

  useEffect(() => {
    if (!excalidrawAPI || !remoteElements || remoteElements.length === 0) return;
    
    // Check if the remote elements are actually different from our current local elements
    const remoteVersion = remoteElements.reduce((acc, el) => acc + (el.version || 0), 0);
    const localElements = excalidrawAPI.getSceneElements();
    const localVersion = localElements.reduce((acc: number, el: any) => acc + (el.version || 0), 0);
    
    if (remoteVersion !== localVersion) {
      isUpdatingRef.current = true;
      excalidrawAPI.updateScene({ elements: remoteElements });
      setTimeout(() => { isUpdatingRef.current = false; }, 50);
    }
  }, [remoteElements, excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI) return;

    // Fetch asynchronously in the background so the user can draw immediately
    fetch('/excalidraw-libraries.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.libraryItems) {
          // Use setTimeout to yield to the main thread and prevent UI freeze
          setTimeout(() => {
            try {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
                merge: true,
              });
            } catch (e) {
              console.error("Excalidraw library merge failed:", e);
            }
          }, 500);
        }
      })
      .catch(err => {
        console.error("Failed to load libraries", err);
      });
  }, [excalidrawAPI]);

  const handleOnChange = (elements: readonly any[], appState: any) => {
    if (isUpdatingRef.current) return;
    if (onChange) {
      onChange(elements, appState);
    }
  };

  return (
    <Excalidraw 
      excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
      onChange={handleOnChange}
    >
      <MainMenu>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.ToggleTheme />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      
      {/* Remove the Excalidraw links from the Welcome Screen */}
      <WelcomeScreen>
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Hints.MenuHint />
        <WelcomeScreen.Hints.HelpHint />
      </WelcomeScreen>
    </Excalidraw>
  );
}
