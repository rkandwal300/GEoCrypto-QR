"use client";

import React from "react";
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { useServerInsertedHTML } from "next/navigation";
import { AntdRegistry as NextAntdRegistry } from '@ant-design/nextjs-registry';

/**
 * @deprecated Use `AntdRegistry` from `@ant-design/nextjs-registry` instead.
 * This custom registry is kept for reference but the official one is preferred.
 */
export const CustomAntdRegistry = ({ children }: { children: React.ReactNode }) => {
  const cache = createCache();
  useServerInsertedHTML(() => (
    <style
      id="antd"
      dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }}
    />
  ));
  return <StyleProvider cache={cache}>{children}</StyleProvider>;
};


export const AntdRegistry = NextAntdRegistry;
