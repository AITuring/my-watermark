import { useState, useEffect } from 'react';
import photosData from './photos.json'; // 导入构建时生成的 JSON
import { Modal, Button, Slider, Space,Image, Tooltip } from 'antd';

import { ReloadOutlined, SwapOutlined } from '@ant-design/icons'

// 定义类型
interface Photo {
  src: string;
  width: number;
  height: number;
  srcSet?: { src: string; width: number; height: number }[];
}

function App() {
  // 如果你是本地开发，可能 json 一开始是空的，这里做个简单处理
  const photos: Photo[] = (photosData as Photo[]) || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {photos.length > 0 ? (
        <Image.PreviewGroup
          preview={{
            // 保留默认工具栏（放大、缩小、旋转、关闭）；这里加个遮罩文案“预览”
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {photos.map((p, idx) => (
              <Image
                key={idx}
                src={p.src}
                alt={`photo-${idx}`}
                style={{ width: '100%', height: 'auto', borderRadius: 4 }}
                preview={{
                  mask: (
                    <div
                      style={{
                        color: '#fff',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      预览
                    </div>
                  ),
                }}
              />
            ))}
          </div>
        </Image.PreviewGroup>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          Loading photos... (Make sure to run build script)
        </div>
      )}
    </div>
  );
}

export default App;
