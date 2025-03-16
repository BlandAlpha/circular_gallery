'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Link2, Trash2, Paintbrush, ChevronDown } from 'lucide-react';
import './CircularGallery.css';

interface Photo {
  id: string;
  src: string;
  name: string;
}

interface Connection {
  from: string;
  to: string;
  style?: string;
}

interface TempLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DragStart {
  photoId: string;
  x: number;
  y: number;
}

interface Position {
  x: number;
  y: number;
  size: number;
}

interface Positions {
  [key: string]: Position;
}

const CircularGallery = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dragStart, setDragStart] = useState<DragStart | null>(null);
  const [tempLine, setTempLine] = useState<TempLine | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 处理照片上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos(prevPhotos => [
            ...prevPhotos,
            {
              id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              src: e.target?.result as string,
              name: file.name
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  };
  
  // 删除照片
  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(photo => photo.id !== photoId));
    setConnections(connections.filter(conn => 
      conn.from !== photoId && conn.to !== photoId
    ));
    setActiveMenu(null);
  };
  
  // 删除连线
  const removeConnection = (index: number) => {
    setConnections(connections.filter((_, i) => i !== index));
    setActiveMenu(null);
  };
  
  // 更改连线样式
  const changeConnectionStyle = (index: number, style: string) => {
    setConnections(connections.map((conn, i) => {
      if (i === index) {
        return { ...conn, style };
      }
      return conn;
    }));
    setActiveMenu(null);
  };
  
  // 切换连线菜单
  const toggleMenu = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeMenu === index) {
      setActiveMenu(null);
    } else {
      setActiveMenu(index);
    }
  };
  
  // 点击其他地方关闭菜单
  const handleOutsideClick = () => {
    if (activeMenu !== null) {
      setActiveMenu(null);
    }
  };
  
  // 计算照片大小
  const calculatePhotoSize = () => {
    if (!containerRef.current || photos.length === 0) return 80;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const minDimension = Math.min(containerRect.width, containerRect.height);
    
    // 基于容器大小计算
    const maxSize = Math.min(100, minDimension / 6);
    const minSize = Math.max(30, minDimension / 20);
    
    if (photos.length <= 5) return maxSize;
    if (photos.length >= 20) return minSize;
    
    // 5到20张照片之间线性缩放
    return maxSize - ((photos.length - 5) * ((maxSize - minSize) / 15));
  };
  
  // 计算圆形布局位置
  const calculateCirclePositions = (): Positions => {
    if (!containerRef.current || photos.length === 0) return {};
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    const photoSize = calculatePhotoSize();
    const photoRadius = photoSize / 2;
    
    // 计算安全半径，确保照片在容器内
    const padding = photoSize;
    const maxRadius = Math.min(centerX, centerY) - padding;
    
    // 确保照片之间有足够的空间
    const circumference = 2 * Math.PI * maxRadius;
    const spaceBetweenPhotos = circumference / photos.length;
    
    // 如果需要，调整半径以防止重叠
    let radius = maxRadius;
    if (spaceBetweenPhotos < photoSize * 1.2) {
      radius = (photos.length * photoSize * 1.2) / (2 * Math.PI);
      
      // 如果计算的半径太大，则减小照片大小
      if (radius > maxRadius) {
        return calculateCirclePositions(); // 使用调整后的大小重新计算
      }
    }
    
    const positions: Positions = {};
    
    photos.forEach((photo, index) => {
      const angle = (2 * Math.PI * index) / photos.length;
      const x = centerX + radius * Math.cos(angle) - photoRadius;
      const y = centerY + radius * Math.sin(angle) - photoRadius;
      
      positions[photo.id] = { x, y, size: photoSize };
    });
    
    return positions;
  };
  
  // 获取照片位置
  const getPhotoPosition = (photoId: string, positions: Positions): Position => {
    if (!positions[photoId]) return { x: 0, y: 0, size: calculatePhotoSize() };
    return positions[photoId];
  };
  
  // 开始拖动创建连线
  const handleDragStart = (e: React.MouseEvent, photoId: string) => {
    e.preventDefault();
    // 关闭任何打开的菜单
    setActiveMenu(null);
    
    const position = getPhotoPosition(photoId, calculateCirclePositions());
    
    setDragStart({
      photoId,
      x: position.x + position.size / 2,
      y: position.y + position.size / 2
    });
  };
  
  // 处理拖动移动
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragStart || !containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setTempLine({
      x1: dragStart.x,
      y1: dragStart.y,
      x2: x,
      y2: y
    });
  };
  
  // 在另一张照片上完成连线
  const handleDrop = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    
    if (dragStart && dragStart.photoId !== targetId) {
      // 检查连线是否已存在
      const connectionExists = connections.some(
        conn => (conn.from === dragStart.photoId && conn.to === targetId) || 
               (conn.to === dragStart.photoId && conn.from === targetId)
      );
      
      if (!connectionExists) {
        setConnections([
          ...connections,
          { 
            from: dragStart.photoId, 
            to: targetId,
            style: 'default' // 新连线的默认样式
          }
        ]);
      }
    }
    
    // 重置拖动状态
    setDragStart(null);
    setTempLine(null);
  };
  
  // 处理拖动结束（未在照片上释放）
  const handleDragEnd = () => {
    setDragStart(null);
    setTempLine(null);
  };
  
  // 根据连线样式获取线条样式
  const getLineStyle = (style?: string) => {
    switch(style) {
      case 'dashed':
        return { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5,5' };
      case 'dotted':
        return { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '2,2' };
      case 'thick':
        return { stroke: '#3B82F6', strokeWidth: 4, strokeDasharray: 'none' };
      case 'red':
        return { stroke: '#EF4444', strokeWidth: 2, strokeDasharray: 'none' };
      case 'green':
        return { stroke: '#10B981', strokeWidth: 2, strokeDasharray: 'none' };
      default:
        return { stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: 'none' };
    }
  };
  
  // 绘制连线
  const renderConnections = (positions: Positions) => {
    return connections.map((connection, index) => {
      const fromPos = getPhotoPosition(connection.from, positions);
      const toPos = getPhotoPosition(connection.to, positions);
      
      // 计算每个照片的中心
      const fromX = fromPos.x + fromPos.size / 2;
      const fromY = fromPos.y + fromPos.size / 2;
      const toX = toPos.x + toPos.size / 2;
      const toY = toPos.y + toPos.size / 2;
      
      // 菜单的中点
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      
      // 获取线条样式
      const lineStyle = getLineStyle(connection.style);
      
      return (
        <div key={`conn-${index}`} className="absolute top-0 left-0 w-full h-full">
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <line
              x1={fromX}
              y1={fromY}
              x2={toX}
              y2={toY}
              stroke={lineStyle.stroke}
              strokeWidth={lineStyle.strokeWidth}
              strokeDasharray={lineStyle.strokeDasharray}
            />
          </svg>
          
          {/* 连线控制点和菜单 */}
          <button
            className="connection-control"
            style={{
              left: `${midX - 12}px`,
              top: `${midY - 12}px`,
            }}
            onClick={(e) => toggleMenu(index, e)}
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${activeMenu === index ? 'rotate-180' : ''}`} />
          </button>
          
          {/* 选项菜单弹出 */}
          {activeMenu === index && (
            <div 
              className="connection-menu"
              style={{
                left: `${midX + 10}px`,
                top: `${midY - 10}px`,
              }}
            >
              <div className="menu-header">
                线条选项
              </div>
              
              <button 
                className="menu-delete-button"
                onClick={() => removeConnection(index)}
              >
                <Trash2 size={14} />
                <span>删除线条</span>
              </button>
              
              <div className="menu-divider"></div>
              <div className="menu-section-title">
                更改样式
              </div>
              
              {['default', 'dashed', 'dotted', 'thick', 'red', 'green'].map(style => (
                <button
                  key={style}
                  className="menu-style-option"
                  onClick={() => changeConnectionStyle(index, style)}
                >
                  <div className="style-preview" style={{
                    backgroundColor: getLineStyle(style).stroke,
                    height: getLineStyle(style).strokeWidth + 'px',
                    borderStyle: getLineStyle(style).strokeDasharray === 'none' ? 'solid' : 
                                 getLineStyle(style).strokeDasharray === '2,2' ? 'dotted' : 'dashed'
                  }}></div>
                  <span className="capitalize">{style === 'default' ? '默认' : 
                                               style === 'dashed' ? '虚线' :
                                               style === 'dotted' ? '点线' :
                                               style === 'thick' ? '粗线' :
                                               style === 'red' ? '红色' : '绿色'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });
  };
  
  // 处理点击菜单外部
  useEffect(() => {
    if (activeMenu !== null) {
      const handleDocumentClick = (e: MouseEvent) => {
        // 检查点击是否在菜单项内
        if ((e.target as HTMLElement).closest('[role="menuitem"]')) return;
        
        // 否则关闭菜单
        setActiveMenu(null);
      };
      
      document.addEventListener('click', handleDocumentClick);
      return () => {
        document.removeEventListener('click', handleDocumentClick);
      };
    }
  }, [activeMenu]);
  
  // 窗口大小变化时重新计算位置
  useEffect(() => {
    const handleResize = () => {
      // 强制重新渲染以重新计算位置
      setPhotos([...photos]);
      setActiveMenu(null);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [photos]);
  
  // 添加鼠标事件监听器
  useEffect(() => {
    if (dragStart) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [dragStart]);
  
  // 计算渲染的位置
  const positions = calculateCirclePositions();
  
  return (
    <div className="gallery-container-wrapper" onClick={handleOutsideClick}>
      <div className="gallery-header">
        <h1 className="gallery-title">CP连连看</h1>
        <div className="gallery-actions">
          <label className="upload-button">
            <Upload size={18} />
            <span>上传照片</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
      
      {photos.length === 0 ? (
        <div className="empty-gallery">
          <Upload size={48} className="upload-icon" />
          <p>上传照片以创建连连看布局</p>
        </div>
      ) : (
        <div 
          ref={containerRef} 
          className="gallery-container"
        >
          {renderConnections(positions)}
          
          {/* 拖动时的临时线条 */}
          {tempLine && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <line
                x1={tempLine.x1}
                y1={tempLine.y1}
                x2={tempLine.x2}
                y2={tempLine.y2}
                stroke="#3B82F6"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            </svg>
          )}
          
          {photos.map((photo) => {
            const position = getPhotoPosition(photo.id, positions);
            
            return (
              <div
                key={photo.id}
                className="photo-item"
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${position.size}px`,
                  height: `${position.size}px`,
                }}
                onMouseDown={(e) => handleDragStart(e, photo.id)}
                onMouseUp={(e) => handleDrop(e, photo.id)}
              >
                <div className="photo-wrapper">
                  <div 
                    className="photo-container"
                    style={{
                      width: `${position.size}px`,
                      height: `${position.size}px`
                    }}
                  >
                    <img
                      src={photo.src}
                      alt={photo.name}
                      className="photo-image"
                      draggable={false}
                    />
                  </div>
                  
                  <button
                    className="delete-button"
                    style={{
                      fontSize: `${Math.max(position.size / 8, 10)}px`,
                      padding: `${Math.max(position.size / 24, 4)}px`
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(photo.id);
                    }}
                  >
                    <X size={Math.max(position.size / 8, 10)} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {photos.length > 0 && (
        <div className="instructions">
          <h2 className="instructions-title">操作说明：</h2>
          <ul className="instructions-list">
            <li>• 照片会自动排列在圆形中</li>
            <li>• 照片大小会根据数量和容器大小自动调整</li>
            <li>• 从一个照片拖拽到另一个照片创建连线</li> 
            <li>• 点击线条中间的控制点访问选项</li>
            <li>• 您可以从菜单中删除连线或更改其样式</li>
            <li>• 悬停在照片上并点击红色X删除照片</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CircularGallery; 