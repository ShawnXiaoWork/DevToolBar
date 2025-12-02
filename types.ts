import React from 'react';

export type ToolId = 'timestamp' | 'json';
export type Language = 'en' | 'zh';

export interface ToolConfig {
  id: ToolId;
  icon: React.ReactNode;
}

export interface NavItemProps {
  tool: ToolConfig;
  isActive: boolean;
  onClick: (id: ToolId) => void;
  isCollapsed: boolean;
}
