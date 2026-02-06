/**
 * 图标处理工具函数
 */

/**
 * 默认图标路径（用于回退）
 */
const DEFAULT_ICON = 'icons/logo.png';

/**
 * 根据当前位置处理图标路径
 * @param iconPath 原始图标路径
 * @param parentDepth 当前文件相对于根目录的层级（如 popup/ 目录为 1）
 * @returns 处理后的图标路径
 */
export function resolveIconPath(iconPath: string, parentDepth: number = 0): string {
  if (iconPath.startsWith('icons/')) {
    // 添加相应数量的 ../ 前缀
    const prefix = parentDepth > 0 ? '../'.repeat(parentDepth) : '';
    return `${prefix}${iconPath}`;
  }
  return iconPath;
}

/**
 * 为 HTMLImageElement 设置图标并绑定错误回退
 * @param img 图像元素
 * @param iconPath 图标路径
 * @param parentDepth 当前文件相对于根目录的层级
 */
export function setupIconWithFallback(
  img: HTMLImageElement,
  iconPath: string,
  parentDepth: number = 0
): void {
  const resolvedPath = resolveIconPath(iconPath, parentDepth);
  const defaultIcon = resolveIconPath(DEFAULT_ICON, parentDepth);

  img.src = resolvedPath;
  img.onerror = () => {
    // 防止循环触发，只在第一次失败时替换
    if (!img.src.endsWith(defaultIcon)) {
      img.src = defaultIcon;
    }
  };
}
