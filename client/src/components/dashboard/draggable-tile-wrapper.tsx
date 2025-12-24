import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

interface DraggableTileWrapperProps {
  children: React.ReactNode;
  isDragMode: boolean;
  tileId: string;
  position?: { x: number; y: number };
}

export function DraggableTileWrapper({ 
  children, 
  isDragMode, 
  tileId, 
  position = { x: 0, y: 0 }
}: DraggableTileWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: tileId,
    disabled: !isDragMode,
  });

  // Apply transforms only when in drag mode - separate states for drag and grid modes
  const hasPosition = position.x !== 0 || position.y !== 0;
  
  // If not in drag mode, use default grid layout (no transforms)
  if (!isDragMode) {
    return (
      <div 
        className="min-w-0 max-w-full"
      >
        {children}
      </div>
    );
  }

  // In drag mode, apply stored positions and current drag transforms
  const style = {
    transform: hasPosition || transform 
      ? `translate3d(${position.x + (transform?.x || 0)}px, ${position.y + (transform?.y || 0)}px, 0)`
      : undefined,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : 'auto',
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    ...(hasPosition && {
      position: 'relative' as const,
    })
  };

  // In drag mode, add drag handle and functionality with position transforms
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="min-w-0 max-w-full relative group"
      data-testid={`draggable-wrapper-${tileId}`}
    >
      {/* Drag Handle - only visible in drag mode */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="p-1 rounded cursor-grab active:cursor-grabbing bg-background/90 hover:bg-background border border-border/50 shadow-sm"
          data-testid={`drag-handle-${tileId}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {/* Tile Content */}
      <div className="h-full">
        {children}
      </div>
    </div>
  );
}