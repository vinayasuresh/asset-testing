import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';

interface DashboardTile {
  id: string;
  title: string;
  component: React.ReactNode;
  size: 'small' | 'medium' | 'large' | 'full';
}

interface SortableItemProps {
  tile: DashboardTile;
  isDragging?: boolean;
}

function SortableItem({ tile, isDragging }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const sizeClasses = {
    small: 'col-span-1',
    medium: 'col-span-2 md:col-span-1',
    large: 'col-span-2',
    full: 'col-span-full',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${sizeClasses[tile.size]} relative group`}
      data-testid={`draggable-tile-${tile.id}`}
    >
      <Card className="relative h-full">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-10 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-background/80 hover:bg-background border border-border/50"
          data-testid={`drag-handle-${tile.id}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {/* Tile Content */}
        <div className="h-full">
          {tile.component}
        </div>
      </Card>
    </div>
  );
}

interface DraggableGridProps {
  tiles: DashboardTile[];
  onLayoutChange?: (newLayout: string[]) => void;
  className?: string;
}

export function DraggableGrid({ tiles, onLayoutChange, className }: DraggableGridProps) {
  const [items, setItems] = useState<DashboardTile[]>(tiles);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Add small distance to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved layout on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
      try {
        const layoutOrder = JSON.parse(savedLayout);
        const reorderedTiles = layoutOrder
          .map((id: string) => tiles.find(tile => tile.id === id))
          .filter(Boolean);
        
        // Add any new tiles that weren't in the saved layout
        const remainingTiles = tiles.filter(
          tile => !layoutOrder.includes(tile.id)
        );
        
        setItems([...reorderedTiles, ...remainingTiles]);
      } catch (error) {
        console.error('Failed to load dashboard layout:', error);
        setItems(tiles);
      }
    } else {
      setItems(tiles);
    }
  }, [tiles]);

  // Save layout changes
  const saveLayout = (newItems: DashboardTile[]) => {
    const layoutOrder = newItems.map(item => item.id);
    localStorage.setItem('dashboard-layout', JSON.stringify(layoutOrder));
    onLayoutChange?.(layoutOrder);
  };

  function handleDragStart() {
    setIsDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setIsDragging(false);

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        saveLayout(newItems);
        return newItems;
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(item => item.id)} strategy={rectSortingStrategy}>
        <div 
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className || ''}`}
          data-testid="draggable-grid"
        >
          {items.map((tile) => (
            <SortableItem
              key={tile.id}
              tile={tile}
              isDragging={isDragging}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Helper function to reset layout to default
export function resetDashboardLayout() {
  localStorage.removeItem('dashboard-layout');
}