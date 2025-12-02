import React from 'react';

export type ToolId = 'timestamp' | 'json';

export interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export interface NavItemProps {
  tool: ToolConfig;
  isActive: boolean;
  onClick: (id: ToolId) => void;
  isCollapsed: boolean;
}