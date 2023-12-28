import { forwardRef, useCallback, useState, useRef, memo } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { FloatButton, Spin, message, Button, Slider } from "antd";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { PictureFilled } from "@ant-design/icons";
import clsx from "clsx";
import {
  PhotoAlbum,
  RenderContainer,
  Photo,
  RenderPhotoProps,
} from "react-photo-album";
import html2canvas from "html2canvas";
import "./puzzle.css";

interface SortablePhoto extends Photo {
  id: UniqueIdentifier;
}

type SortablePhotoProps = RenderPhotoProps<SortablePhoto>;

type PhotoFrameProps = SortablePhotoProps & {
  overlay?: boolean;
  active?: boolean;
  insertPosition?: "before" | "after";
  attributes?: Partial<React.HTMLAttributes<HTMLDivElement>>;
  listeners?: Partial<React.HTMLAttributes<HTMLDivElement>>;
};
interface ImgProp {
  id: string;
  src: string;
  width: number;
  height: number;
}

const PhotoFrame = memo(
  forwardRef<HTMLDivElement, PhotoFrameProps>(function PhotoFrame(props, ref) {
    const {
      layoutOptions,
      imageProps,
      overlay,
      active,
      insertPosition,
      attributes,
      listeners,
    } = props;
    const { alt, style, ...restImageProps } = imageProps;

    return (
      <div
        ref={ref}
        style={{
          width: overlay
            ? `calc(100% - ${2 * layoutOptions.padding}px)`
            : style.width,
          padding: style.padding,
          marginBottom: style.marginBottom,
        }}
        className={clsx("photo-frame", {
          overlay: overlay,
          active: active,
          insertBefore: insertPosition === "before",
          insertAfter: insertPosition === "after",
        })}
        {...attributes}
        {...listeners}
      >
        <img
          alt={alt}
          style={{
            ...style,
            width: "100%",
            height: "auto",
            padding: 0,
            marginBottom: 0,
          }}
          {...restImageProps}
        />
      </div>
    );
  })
);

function SortablePhotoFrame(
  props: SortablePhotoProps & { activeIndex?: number }
) {
  const { photo, activeIndex } = props;
  const { attributes, listeners, isDragging, index, over, setNodeRef } =
    useSortable({ id: photo.id });

  return (
    <PhotoFrame
      ref={setNodeRef}
      active={isDragging}
      insertPosition={
        activeIndex !== undefined && over?.id === photo.id && !isDragging
          ? index > activeIndex
            ? "after"
            : "before"
          : undefined
      }
      aria-label="sortable image"
      attributes={attributes}
      listeners={listeners}
      {...props}
    />
  );
}

const Puzzle = () => {
  const navigate = useNavigate();
  const galleryRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState<ImgProp[]>([]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [isUpload, setIsUpload] = useState<boolean>(false);
  const [inputColumns, setInputColumns] = useState<number>(3);

  const renderedPhotos = useRef<{ [key: string]: SortablePhotoProps }>({});
  const [activeId, setActiveId] = useState<UniqueIdentifier>();
  const activeIndex = activeId
    ? images.findIndex((photo) => photo.id === activeId)
    : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 50, tolerance: 10 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => setActiveId(active.id),
    []
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(undefined);
  }, []);

  const renderPhoto = (props: SortablePhotoProps) => {
    // capture rendered photos for future use in DragOverlay
    renderedPhotos.current[props.photo.id] = props;
    return <SortablePhotoFrame activeIndex={activeIndex} {...props} />;
  };

  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    acceptedFiles.forEach((file) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            id: src,
            src: src,
            width: img.width,
            height: img.height,
          },
        ]);
      };
      setIsUpload(true);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  const downloadImage = async () => {
    if (files.length === 0) {
      message.error("请选择图片");
      return;
    }
    const galleryElement = galleryRef.current;
    setSpinning(true);
    if (galleryElement) {
      const canvas = await html2canvas(galleryElement, { scale: 8 });

      // 导出最终的图片
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "my-image.png";
            link.click();
            setSpinning(false);
          }
        },
        "image/jpeg",
        0.9
      );
    } else {
      const galleryElement = document.getElementById("container");
      const canvas = await html2canvas(galleryElement, { scale: 8 });
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "my-image.jpeg";
            link.click();
            setSpinning(false);
          }
        },
        "image/jpeg",
        0.9
      );
    }
  };

  const renderContainer: RenderContainer = ({
    containerProps,
    children,
    containerRef,
  }) => (
    <div ref={galleryRef} id="container">
      <div ref={containerRef} {...containerProps} id="gallery">
        {children}
      </div>
    </div>
  );

  return (
    <div className="puzzle">
      {isUpload ? (
        <div className="album">
          <div className="tab">
            <h2>大图生成</h2>
            <div className="controls">
              <Button type="primary" onClick={downloadImage}>
                下载大图
              </Button>
              <div className="slide">
                <div>图片列数:</div>
                <Slider
                  style={{ width: "100px", marginLeft: "20px" }}
                  min={1}
                  max={6}
                  onChange={(value) => setInputColumns(value)}
                  value={typeof inputColumns === "number" ? inputColumns : 0}
                />
              </div>
              <Button
                onClick={() => {
                  setImages([]);
                  setFiles([]);
                  setIsUpload(false);
                }}
              >
                清空
              </Button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={images}>
              <div style={{ margin: 30 }}>
                <PhotoAlbum
                  layout="columns"
                  photos={images}
                  padding={0}
                  spacing={0}
                  columns={inputColumns}
                  renderContainer={renderContainer}
                  renderPhoto={renderPhoto}
                />
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId && (
                <PhotoFrame overlay {...renderedPhotos.current[activeId]} />
              )}
            </DragOverlay>
          </DndContext>
          {/* <PhotoAlbum
            layout="columns"
            photos={images}
            padding={0}
            spacing={0}
            columns={inputColumns}
            renderContainer={renderContainer}
          /> */}
        </div>
      ) : (
        <div className="upload">
          <img
            src="https://bing.img.run/rand_uhd.php"
            alt="bg"
            className="bg"
          />
          <input {...getInputProps()} />
          <div {...getRootProps()} className="upload-button">
            <div>选择（或拖拽）图片</div>
            <div className="upload-desc">请不要上传太多图片，否则处理速度会很慢</div>
          </div>
        </div>
      )}
      <FloatButton
        icon={<PictureFilled />}
        tooltip={<div>添加水印</div>}
        onClick={() => navigate("/")}
      />
      <Spin spinning={spinning} fullscreen size="large" />
    </div>
  );
};

export default Puzzle;
