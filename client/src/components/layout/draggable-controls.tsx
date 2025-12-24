import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings2, 
  MousePointer2, 
  Search, 
  Bot, 
  Plus,
  Info
} from 'lucide-react';

interface DraggableControlsProps {
  globalSearchDraggable: boolean;
  onGlobalSearchDraggableChange: (enabled: boolean) => void;
  assetsSearchDraggable: boolean;
  onAssetsSearchDraggableChange: (enabled: boolean) => void;
}

export function DraggableControls({
  globalSearchDraggable,
  onGlobalSearchDraggableChange,
  assetsSearchDraggable,
  onAssetsSearchDraggableChange
}: DraggableControlsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const draggableComponents = [
    {
      name: 'AI Assistant',
      description: 'Floating AI assistant button',
      icon: Bot,
      enabled: true, // Always enabled
      readonly: true
    },
    {
      name: 'Quick Actions',
      description: 'Quick create (+) button',
      icon: Plus,
      enabled: true, // Always enabled
      readonly: true
    },
    {
      name: 'Global Search',
      description: 'Search bar from TopBar',
      icon: Search,
      enabled: globalSearchDraggable,
      readonly: false,
      onChange: onGlobalSearchDraggableChange
    },
    {
      name: 'Assets Search',
      description: 'Search bar from Assets page',
      icon: Search,
      enabled: assetsSearchDraggable,
      readonly: false,
      onChange: onAssetsSearchDraggableChange
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-4 z-20 shadow-lg"
          data-testid="button-draggable-controls"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Draggable UI
          <Badge variant="secondary" className="ml-2">
            {draggableComponents.filter(c => c.enabled).length}
          </Badge>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MousePointer2 className="h-5 w-5" />
            Draggable UI Components
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">Draggable Mode</p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Enable dragging for search bars to move them anywhere on screen. 
                Positions are saved automatically.
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            {draggableComponents.map((component) => {
              const Icon = component.icon;
              return (
                <Card key={component.name} className="p-3">
                  <div className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{component.name}</span>
                          {component.readonly && (
                            <Badge variant="secondary" className="text-xs">
                              Always On
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {component.description}
                        </p>
                      </div>
                    </div>
                    
                    <Switch
                      checked={component.enabled}
                      onCheckedChange={component.readonly ? undefined : component.onChange}
                      disabled={component.readonly}
                      data-testid={`switch-${component.name.toLowerCase().replace(' ', '-')}`}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
          
          <div className="pt-2">
            <Button
              onClick={() => setIsOpen(false)}
              className="w-full"
              data-testid="button-close-draggable-controls"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}