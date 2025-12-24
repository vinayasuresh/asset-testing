import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, RotateCcw } from 'lucide-react';

interface TilePosition {
  x: number;
  y: number;
}

interface DashboardTile {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultPosition?: TilePosition;
  width?: number;
  height?: number;
  section?: string; // For grouping tiles by section
}

// Context for managing tile resets
interface TileResetContextType {
  resetTile: (tileId: string) => void;
  resetSection: (section: string) => void;
  resetAllTiles: () => void;
}

const TileResetContext = createContext<TileResetContextType | null>(null);

function DraggableTileInternal({ 
  tile, 
  position,
  showDragHandle = true 
}: { 
  tile: DashboardTile; 
  position: TilePosition;
  showDragHandle?: boolean;
}) {
  const resetContext = useContext(TileResetContext);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  const style = {
    position: 'absolute' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : 10,
    width: tile.width,
    height: tile.height,
    // Enforce exact dimensions from grid mode - no responsive resizing in drag mode
    minWidth: tile.width,
    maxWidth: tile.width,
    minHeight: tile.height,
    maxHeight: tile.height,
    boxSizing: 'border-box' as const,
  };

  const handleResetTile = () => {
    if (resetContext) {
      resetContext.resetTile(tile.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
      data-testid={`independent-tile-${tile.id}`}
    >
      {/* Floating Controls - positioned above the tile */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Reset Tile Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetTile}
          className="p-1 h-6 w-6 bg-background/90 hover:bg-background border border-border/50 shadow-sm"
          data-testid={`tile-reset-${tile.id}`}
          title="Reset to default position"
        >
          <RotateCcw className="h-3 w-3 text-muted-foreground" />
        </Button>
        {/* Drag Handle - only show when dragging is enabled */}
        {showDragHandle && (
          <div
            {...attributes}
            {...listeners}
            className="p-1 rounded cursor-grab active:cursor-grabbing bg-background/90 hover:bg-background border border-border/50 shadow-sm"
            data-testid={`tile-drag-handle-${tile.id}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {/* Single tile content without double card wrapping */}
      <div className="h-full">
        {tile.component}
      </div>
    </div>
  );
}

function IndependentDraggableTileWithContext({ 
  tile, 
  onPositionChange,
  externalPosition,
  isDraggingEnabled = true 
}: { 
  tile: DashboardTile;
  onPositionChange: (tileId: string, position: TilePosition) => void;
  externalPosition?: TilePosition;
  isDraggingEnabled?: boolean;
}) {
  const isInit = useRef(true);
  const skipSave = useRef(false);
  
  // Remove redundant screen size monitoring (handled by parent)
  
  const [position, setPosition] = useState<TilePosition>(() => {
    // Use external position if provided (responsive layout)
    if (externalPosition) {
      return externalPosition;
    }
    
    // Try to get saved position from enhanced layout storage (desktop only)
    const savedLayouts = localStorage.getItem('dashboard-layout-v1');
    if (savedLayouts) {
      const layouts = JSON.parse(savedLayouts);
      if (layouts[tile.id]) {
        const savedPos = layouts[tile.id];
        return {
          x: Math.max(20, Math.min(1200, savedPos.x)),
          y: Math.max(20, Math.min(1200, savedPos.y))
        };
      }
    }
    
    // Provide safe default position within canvas bounds
    const defaultPos = tile.defaultPosition || { x: 100, y: 100 };
    return {
      x: Math.max(20, Math.min(1200, defaultPos.x)),
      y: Math.max(20, Math.min(1200, defaultPos.y))
    };
  });
  
  // Sync internal position with external position changes (responsive layout)
  useEffect(() => {
    if (externalPosition) {
      skipSave.current = true;
      setPosition(externalPosition);
      setTimeout(() => {
        skipSave.current = false;
      }, 0);
    }
  }, [externalPosition]);

  // Keep sensors array stable to avoid React warnings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: isDraggingEnabled ? 8 : 999999, // Effectively disable dragging by requiring huge distance
      },
    })
  );

  useEffect(() => {
    // Skip saving during initialization or when explicitly skipped
    if (isInit.current || skipSave.current) {
      isInit.current = false; // Clear init flag after first render
      return;
    }
    
    // Only call onPositionChange when position actually changes from user actions
    const timeoutId = setTimeout(() => {
      onPositionChange(tile.id, position);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [position.x, position.y, tile.id]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { delta } = event;
    
    if (delta) {
      // Get the main dashboard container bounds for proper screen width clamping
      const mainContainer = document.querySelector('main');
      if (!mainContainer) return;
      
      const containerBounds = mainContainer.getBoundingClientRect();
      const maxWidth = window.innerWidth; // Use full screen width as boundary
      const tileWidth = tile.width;
      const tileHeight = tile.height;
      
      // Clear init and skipSave flags for user-driven position changes
      isInit.current = false;
      skipSave.current = false;
      
      // Calculate new position with screen width boundary enforcement
      const newX = position.x + delta.x;
      const newY = position.y + delta.y;
      
      // Ensure tile never goes past screen width (right edge)
      const boundedX = Math.max(24, Math.min(maxWidth - tileWidth - 24, newX));
      // Allow vertical movement with reasonable bounds
      const boundedY = Math.max(20, Math.min(2000, newY)); // Large Y range for scrolling
      
      const newPosition = {
        x: boundedX,
        y: boundedY,
      };
      setPosition(newPosition);
    }
  };

  // Reset position function
  const resetPosition = () => {
    const defaultPos = tile.defaultPosition || { x: 100, y: 100 };
    // Clear flags to allow saving reset position
    isInit.current = false;
    skipSave.current = false;
    setPosition(defaultPos);
  };

  // Listen for reset events (individual, section, and global) and position clamping
  useEffect(() => {
    const handleReset = (event: CustomEvent) => {
      if (event.detail.tileId === tile.id) {
        resetPosition();
      }
    };

    const handleSectionReset = (event: CustomEvent) => {
      if (tile.section && event.detail.section === tile.section) {
        resetPosition();
      }
    };

    const handleGlobalReset = () => {
      resetPosition();
    };

    const handleClampPosition = (event: CustomEvent) => {
      if (event.detail.tileId === tile.id) {
        // Skip first clamp during initialization to preserve default positions
        if (isInit.current) {
          return;
        }
        
        const { canvasWidth, canvasHeight, tileWidth, tileHeight } = event.detail;
        
        // Set skipSave flag to prevent persisting clamp-induced position changes
        skipSave.current = true;
        setPosition(prev => ({
          x: Math.max(20, Math.min(canvasWidth - tileWidth - 20, prev.x)),
          y: Math.max(20, Math.min(canvasHeight - tileHeight - 20, prev.y))
        }));
        
        // Clear skipSave flag in next microtask
        setTimeout(() => {
          skipSave.current = false;
        }, 0);
      }
    };

    window.addEventListener('reset-tile' as any, handleReset);
    window.addEventListener('reset-section' as any, handleSectionReset);
    window.addEventListener('reset-all-tiles' as any, handleGlobalReset);
    window.addEventListener('clamp-tile-position' as any, handleClampPosition);
    
    return () => {
      window.removeEventListener('reset-tile' as any, handleReset);
      window.removeEventListener('reset-section' as any, handleSectionReset);
      window.removeEventListener('reset-all-tiles' as any, handleGlobalReset);
      window.removeEventListener('clamp-tile-position' as any, handleClampPosition);
    };
  }, [tile.id, tile.section]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[tile.id]}>
        <DraggableTileInternal 
          tile={tile} 
          position={position} 
          showDragHandle={isDraggingEnabled} 
        />
      </SortableContext>
    </DndContext>
  );
}

interface IndependentDraggableTilesProps {
  tiles: DashboardTile[];
  onLayoutChange?: (layouts: Record<string, TilePosition>) => void;
}

export function IndependentDraggableTiles({ tiles, onLayoutChange }: IndependentDraggableTilesProps) {
  const [positions, setPositions] = useState<Record<string, TilePosition>>({});
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Calculate responsive positions based on screen size with collision-free layout
  const getResponsivePosition = (tile: DashboardTile, index: number): TilePosition => {
    const defaultPos = tile.defaultPosition || { x: 100, y: 100 };
    
    // Use saved position if available and not in responsive mode
    const savedLayouts = localStorage.getItem('dashboard-layout-v1');
    if (savedLayouts && screenSize === 'desktop') {
      const layouts = JSON.parse(savedLayouts);
      if (layouts[tile.id]) {
        return layouts[tile.id];
      }
    }
    
    if (screenSize === 'mobile') {
      // Mobile: Stack all tiles vertically with actual tile heights
      let cumulativeY = 140;
      for (let i = 0; i < index; i++) {
        const prevTile = tiles[i];
        const prevHeight = prevTile.section === 'analytics' ? 300 : 
                          prevTile.section === 'visual' ? 350 : 220;
        cumulativeY += prevHeight + 24; // Add tile height + 24px gap
      }
      return {
        x: 20,
        y: cumulativeY
      };
    } else if (screenSize === 'tablet') {
      // Tablet: 2-column layout with collision-free positioning
      const columnHeights = [140, 140]; // Track height of each column
      
      // Calculate positions for all tiles up to current index
      for (let i = 0; i <= index; i++) {
        const currentTile = tiles[i];
        const tileHeight = currentTile.section === 'analytics' ? 280 : 
                          currentTile.section === 'visual' ? 320 : 200;
        
        if (i === index) {
          // Place current tile in shorter column
          const column = columnHeights[0] <= columnHeights[1] ? 0 : 1;
          return {
            x: 20 + (column * 360),
            y: columnHeights[column]
          };
        } else {
          // Update column heights for previous tiles
          const column = columnHeights[0] <= columnHeights[1] ? 0 : 1;
          columnHeights[column] += tileHeight + 24;
        }
      }
    }
    
    // Desktop: Use default positions
    return defaultPos;
  };

  const handlePositionChange = (tileId: string, position: TilePosition) => {
    // Only allow position changes on desktop - ignore on mobile/tablet for controlled layout
    if (screenSize !== 'desktop') {
      return;
    }
    
    setPositions(prev => {
      const newPositions = { ...prev, [tileId]: position };
      
      // Save to localStorage on desktop to preserve manual positioning
      localStorage.setItem('dashboard-layout-v1', JSON.stringify(newPositions));
      
      // Notify parent component
      if (onLayoutChange) {
        onLayoutChange(newPositions);
      }
      
      return newPositions;
    });
  };
  
  // Update positions when screen size changes
  useEffect(() => {
    const newPositions: Record<string, TilePosition> = {};
    tiles.forEach((tile, index) => {
      newPositions[tile.id] = getResponsivePosition(tile, index);
    });
    setPositions(newPositions);
    
    if (onLayoutChange) {
      onLayoutChange(newPositions);
    }
  }, [screenSize, tiles, onLayoutChange]);

  // Update screen size and handle responsive positioning
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    // Initial screen size check
    updateScreenSize();
    
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Clamp all positions on window resize (debounced to prevent transient narrow widths)
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>;
    let isInitialized = false;
    
    const handleResize = () => {
      // Clear existing timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Debounce resize events to avoid transient canvas widths
      resizeTimeout = setTimeout(() => {
        // Skip clamping during initial load to preserve default positions
        if (!isInitialized) {
          isInitialized = true;
          return;
        }
        
        const canvasElement = document.getElementById('dashboard-canvas');
        if (!canvasElement) return;
        
        const canvasBounds = canvasElement.getBoundingClientRect();
        const canvasWidth = canvasBounds.width;
        const canvasHeight = Math.max(canvasBounds.height, 1400);
        
        // Clamp tiles for all screen sizes to prevent off-canvas positioning
        
        // Dispatch resize event for all tiles to re-clamp their positions
        tiles.forEach(tile => {
          window.dispatchEvent(new CustomEvent('clamp-tile-position', { 
            detail: { 
              tileId: tile.id,
              canvasWidth,
              canvasHeight,
              tileWidth: tile.width,
              tileHeight: tile.height
            } 
          }));
        });
      }, 200); // 200ms debounce delay
    };

    // Initialize after first paint to ensure canvas is properly sized
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isInitialized = true;
      });
    });

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, [tiles]);

  const resetContext: TileResetContextType = {
    resetTile: (tileId: string) => {
      // Dispatch custom event to reset specific tile
      window.dispatchEvent(new CustomEvent('reset-tile', { detail: { tileId } }));
    },
    resetSection: (section: string) => {
      // Reset all tiles in a section
      tiles
        .filter(tile => tile.section === section)
        .forEach(tile => {
          window.dispatchEvent(new CustomEvent('reset-tile', { detail: { tileId: tile.id } }));
        });
    },
    resetAllTiles: () => {
      // Clear all saved positions and reset to defaults
      localStorage.removeItem('dashboard-layout-v1');
      tiles.forEach(tile => {
        // Clear old individual tile storage
        localStorage.removeItem(`tile-position-${tile.id}`);
        // Dispatch reset event
        window.dispatchEvent(new CustomEvent('reset-tile', { detail: { tileId: tile.id } }));
      });
    }
  };

  return (
    <TileResetContext.Provider value={resetContext}>
      {/* Scrollable Canvas Container with Responsive Layout */}
      <div 
        id="dashboard-canvas"
        className={`relative w-full transition-all duration-300 ${
          screenSize === 'mobile' ? 'min-h-screen px-4' : 
          screenSize === 'tablet' ? 'min-h-[1200px] px-6' : 
          'min-h-[1400px] px-6'
        }`}
        data-testid="independent-draggable-tiles-container"
        style={{ 
          // Ensure the canvas extends beyond viewport for scrolling
          minHeight: screenSize === 'mobile' ? '100vh' : 'max(100vh, 1400px)',
          paddingBottom: screenSize === 'mobile' ? '100px' : '200px'
        }}
      >
        {tiles.map((tile, index) => {
          const responsivePosition = positions[tile.id] || getResponsivePosition(tile, index);
          
          // Calculate responsive width to prevent overflow on narrow devices
          const getResponsiveWidth = () => {
            if (screenSize === 'mobile') {
              // Get current canvas width from DOM
              const canvasElement = document.getElementById('dashboard-canvas');
              const canvasWidth = canvasElement ? canvasElement.clientWidth : window.innerWidth;
              // Use calc to account for margins: canvas width - 40px (20px left + 20px right)
              return Math.min(340, canvasWidth - 40);
            } else if (screenSize === 'tablet') {
              const canvasElement = document.getElementById('dashboard-canvas');
              const canvasWidth = canvasElement ? canvasElement.clientWidth : window.innerWidth;
              return Math.min(340, (canvasWidth - 60) / 2); // Account for 2 columns + gaps
            }
            return tile.width;
          };
          
          return (
            <IndependentDraggableTileWithContext 
              key={tile.id} 
              tile={{
                ...tile,
                // Adjust tile dimensions for responsive layout
                width: getResponsiveWidth(),
                height: screenSize === 'mobile' ? 
                        (tile.section === 'analytics' ? 300 : 
                         tile.section === 'visual' ? 350 : 220) :
                        screenSize === 'tablet' ? 
                        (tile.section === 'analytics' ? 280 : 
                         tile.section === 'visual' ? 320 : 200) :
                        tile.height
              }}
              externalPosition={screenSize !== 'desktop' ? responsivePosition : undefined}
              isDraggingEnabled={screenSize === 'desktop'}
              onPositionChange={handlePositionChange}
            />
          );
        })}
      </div>
    </TileResetContext.Provider>
  );
}

// Export the context hook for use in dashboard header
export const useTileReset = () => {
  const context = useContext(TileResetContext);
  if (!context) {
    throw new Error('useTileReset must be used within TileResetContext');
  }
  return context;
};