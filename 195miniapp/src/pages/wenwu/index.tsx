import { View, Text, Input, Picker, Button, Map } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import './index.less'
import artifactsData from '../../195.json'

// 文物数据类型定义（与 Wenwu.tsx 对齐）
interface Artifact {
  id: number
  batch: string
  type: string
  name: string
  era: string
  excavationLocation: string
  excavationTime: string
  collectionLocation: string
  desc: string
}

// 轻量 Markdown 渲染：将常用语法转为纯文本/简单结构
const renderMarkdownLite = (text: string) => {
  const lines = (text || '').split('\n')
  const nodes: { type: 'p'|'h1'|'h2'|'h3'|'ul'|'li'|'code'; content: string }[] = []
  let inCode = false
  let codeBuf: string[] = []
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (!inCode) { inCode = true; codeBuf = [] } else {
        nodes.push({ type: 'code', content: codeBuf.join('\n') })
        inCode = false
      }
      continue
    }
    if (inCode) { codeBuf.push(line); continue }
    if (/^#\s+/.test(line)) nodes.push({ type: 'h1', content: line.replace(/^#\s+/, '') })
    else if (/^##\s+/.test(line)) nodes.push({ type: 'h2', content: line.replace(/^##\s+/, '') })
    else if (/^###\s+/.test(line)) nodes.push({ type: 'h3', content: line.replace(/^###\s+/, '') })
    else if (/^\s*[-*]\s+/.test(line)) nodes.push({ type: 'li', content: line.replace(/^\s*[-*]\s+/, '') })
    else nodes.push({ type: 'p', content: line })
  }
  return nodes
}

// 提取单个博物馆名称（从 Wenwu.tsx 迁移）
const extractMuseumNames = (collectionLocation: string): string[] => {
  const museums = new Set<string>()
  if (!collectionLocation) return []
  const raw = collectionLocation
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/各(馆|博物馆)?(收藏|收藏一半|分藏|各藏).*/g, '')
    .replace(/(等)?(单位|博物馆)?(共同)?(收藏|保管).*/g, '')
  const parts = raw
    .split(/[、，,；;\/\|]|和|与|及/g)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const p of parts) {
    if (p === '原物为一对，一件藏于北京故宫博物院，另一件藏于河南博物院') {
      museums.add('故宫博物院'); museums.add('河南博物院'); continue
    }
    if (p === '上海博物馆、山西博物馆各收藏一半') {
      museums.add('上海博物馆'); museums.add('山西博物馆'); continue
    }
    museums.add(p)
  }
  return Array.from(museums).sort()
}

// 常量：高德 REST API Key（请替换为你的正式 Key，并在小程序中配置域名白名单）
const AMAP_KEY = '7a9513e700e06c00890363af1bd2d926'

// 地理编码缓存（内存 + 本地存储）
type GeoInfo = { lat: number; lng: number; address?: string }
const GEO_CACHE_STORAGE_KEY = 'wenwu_geo_cache_v1'

export default function WenwuPage() {
  const [artifacts] = useState<Artifact[]>(artifactsData as any)
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>(artifacts)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedCollection, setSelectedCollection] = useState('all')
  const [selectedEra, setSelectedEra] = useState('all')
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // 统计筛选结果中出现的博物馆数量
  const filteredMuseumsCount = useMemo(() => {
    const m = new Set<string>()
    filteredArtifacts.forEach((a) => extractMuseumNames(a.collectionLocation).forEach((n) => m.add(n)))
    return m.size
  }, [filteredArtifacts])

  // 选项
  const batches = useMemo(() => Array.from(new Set(artifacts.map(a => a.batch))).sort(), [artifacts])
  const types = useMemo(() => Array.from(new Set(artifacts.map(a => a.type))).sort(), [artifacts])
  const eras = useMemo(() => Array.from(new Set(artifacts.map(a => a.era))).sort(), [artifacts])
  const collections = useMemo(() => {
    const all = new Set<string>()
    artifacts.forEach(a => extractMuseumNames(a.collectionLocation).forEach(n => all.add(n)))
    return Array.from(all).sort()
  }, [artifacts])

  // 筛选逻辑
  useEffect(() => {
    let filtered = artifacts
    if (searchTerm) {
      const s = searchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(s) ||
        item.desc.toLowerCase().includes(s) ||
        item.era.toLowerCase().includes(s) ||
        item.excavationLocation.toLowerCase().includes(s) ||
        item.collectionLocation.toLowerCase().includes(s)
      )
    }
    if (selectedBatch !== 'all') filtered = filtered.filter(i => i.batch === selectedBatch)
    if (selectedType !== 'all') filtered = filtered.filter(i => i.type === selectedType)
    if (selectedEra !== 'all') filtered = filtered.filter(i => i.era === selectedEra)
    if (selectedCollection !== 'all') {
      filtered = filtered.filter(i => extractMuseumNames(i.collectionLocation).includes(selectedCollection))
    }
    setFilteredArtifacts(filtered)
    setCurrentPage(1)
  }, [artifacts, searchTerm, selectedBatch, selectedType, selectedEra, selectedCollection])

  // 分页
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredArtifacts.length / itemsPerPage)), [filteredArtifacts])
  const paginatedArtifacts = useMemo(() =>
    filteredArtifacts.slice((currentPage - 1) * itemsPerPage, (currentPage) * itemsPerPage)
  , [filteredArtifacts, currentPage])

  // 聚合博物馆 -> 文物列表
  const museumMap = useMemo(() => {
    const m = new Map<string, Artifact[]>()
    filteredArtifacts.forEach(a => {
      const ms = extractMuseumNames(a.collectionLocation)
      ms.forEach(name => {
        const arr = m.get(name) || []
        arr.push(a)
        m.set(name, arr)
      })
    })
    return m
  }, [filteredArtifacts])

  // Map 相关
  const [center, setCenter] = useState<{ latitude: number; longitude: number }>({ latitude: 39.90923, longitude: 116.397428 }) // 默认北京
  const [scale, setScale] = useState(5)
  const [markers, setMarkers] = useState<any[]>([])
  const [selectedMuseum, setSelectedMuseum] = useState<{ name: string; list: Artifact[] } | null>(null)

  // 加载/保存缓存
  const [geoCache, setGeoCache] = useState<Record<string, GeoInfo>>(() => {
    try { return Taro.getStorageSync(GEO_CACHE_STORAGE_KEY) || {} } catch { return {} }
  })
  useEffect(() => {
    try { Taro.setStorageSync(GEO_CACHE_STORAGE_KEY, geoCache) } catch {}
  }, [geoCache])

  // 高德 POI 搜索（比纯地理编码更适合博物馆）
  const searchPOI = async (keyword: string): Promise<GeoInfo | null> => {
    try {
      const url = `https://restapi.amap.com/v3/place/text`
      const res = await Taro.request({
        url,
        method: 'GET',
        data: {
          keywords: keyword,
          citylimit: false,
          offset: 1,
          page: 1,
          extensions: 'base',
          key: AMAP_KEY
        }
      })
      const pois = (res.data && (res.data as any).pois) || []
      if (pois.length > 0 && pois[0].location) {
        const [lngStr, latStr] = pois[0].location.split(',')
        const info: GeoInfo = { lng: parseFloat(lngStr), lat: parseFloat(latStr), address: pois[0].address }
        return info
      }
      return null
    } catch {
      return null
    }
  }

  // 构建地图标注：对博物馆去重，异步获取坐标
  useEffect(() => {
    let disposed = false
    const names = Array.from(museumMap.keys())

    const run = async () => {
      const newCache = { ...geoCache }
      const results: { name: string; info: GeoInfo | null; count: number }[] = []
      for (const name of names) {
        const count = museumMap.get(name)?.length || 0
        let info = newCache[name]
        if (!info) {
          info = await searchPOI(name)
          if (info) newCache[name] = info
        }
        results.push({ name, info: info || null, count })
        // 为了防止请求过快，可在必要时添加延时：await new Promise(r => setTimeout(r, 50))
      }
      if (disposed) return
      setGeoCache(newCache)

      const mks = results
        .filter(r => r.info)
        .map((r, idx) => ({
          id: idx,
          latitude: r.info!.lat,
          longitude: r.info!.lng,
          title: r.name,
          // 小程序 Map 的 callout，显示文物数量
          callout: {
            content: `${r.name}\n${r.count} 件`,
            color: '#1f2937',
            fontSize: 12,
            bgColor: '#ffffff',
            borderRadius: 6,
            padding: 6,
            display: 'ALWAYS'
          },
          // label 备选（不同端支持不同）
          label: {
            content: `${r.count}`,
            color: '#ffffff',
            fontSize: 10,
            bgColor: '#3b82f6',
            borderRadius: 10,
            padding: 4,
          }
        }))
      setMarkers(mks)
      // 视野居中（简单策略：如果有标注，用第一个）
      if (mks.length > 0) {
        setCenter({ latitude: mks[0].latitude, longitude: mks[0].longitude })
        setScale(5)
      } else {
        setCenter({ latitude: 39.90923, longitude: 116.397428 })
        setScale(5)
      }
    }

    run()
    return () => { disposed = true }
  }, [museumMap])

  const handleMarkerTap = (e: any) => {
    const mkId = e.detail.markerId
    const mk = markers.find(m => m.id === mkId)
    if (!mk) return
    const name = mk.title
    const list = museumMap.get(name) || []
    setSelectedMuseum({ name, list })
  }

  // 文物详情弹层
  const [detailItem, setDetailItem] = useState<Artifact | null>(null)

  return (
    <View className='page'>
      {/* 筛选 */}
      <View className='filters'>
        <Input
          className='search'
          placeholder='搜索文物名称/描述/时代/地点'
          value={searchTerm}
          onInput={(e) => setSearchTerm(e.detail.value)}
        />
        <Picker mode='selector' range={['all', ...batches]} onChange={(e) => setSelectedBatch((['all', ...batches])[parseInt(e.detail.value)])}>
          <View className='select'>批次：{selectedBatch}</View>
        </Picker>
        <Picker mode='selector' range={['all', ...types]} onChange={(e) => setSelectedType((['all', ...types])[parseInt(e.detail.value)])}>
          <View className='select'>类别：{selectedType}</View>
        </Picker>
        <Picker mode='selector' range={['all', ...eras]} onChange={(e) => setSelectedEra((['all', ...eras])[parseInt(e.detail.value)])}>
          <View className='select'>时代：{selectedEra}</View>
        </Picker>
        <Picker mode='selector' range={['all', ...collections]} onChange={(e) => setSelectedCollection((['all', ...collections])[parseInt(e.detail.value)])}>
          <View className='select'>馆藏：{selectedCollection}</View>
        </Picker>
      </View>

      {/* 视图模式 */}
      <View className='modeToggle'>
        <Button size='mini' onClick={() => setViewMode('grid')} type={viewMode === 'grid' ? 'primary' : 'default'}>网格</Button>
        <Button size='mini' onClick={() => setViewMode('list')} type={viewMode === 'list' ? 'primary' : 'default'}>列表</Button>
      </View>

      <View className='summary'>
        共 {filteredArtifacts.length} 件文物 · 涉及 {filteredMuseumsCount} 个博物馆
      </View>

      {/* 列表/网格 */}
      {viewMode === 'grid' ? (
        <View className='grid'>
          {paginatedArtifacts.map(artifact => (
            <View className='card' key={artifact.id} onClick={() => setDetailItem(artifact)}>
              <View className='cardTitle'>{artifact.name}</View>
              <View className='badges'>
                <Text className='badge'>{artifact.type}</Text>
                <Text className='badge'>{artifact.era}</Text>
                <Text className='badge'>{artifact.excavationLocation}</Text>
              </View>
              <View style={{ color: '#64748b', fontSize: 12 }}>
                {extractMuseumNames(artifact.collectionLocation).join('、')}
              </View>
              <View style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>
                {/* 摘要展示（MarkdownLite） */}
                {renderMarkdownLite(artifact.desc).slice(0, 2).map((n, idx) => (
                  <View key={idx} className='markdown'>
                    <Text>{n.content}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className='list'>
          {paginatedArtifacts.map(artifact => (
            <View className='listItem' key={artifact.id} onClick={() => setDetailItem(artifact)}>
              <View className='itemLeft'>
                <View className='cardTitle'>{artifact.name}</View>
                <View className='badges'>
                  <Text className='badge'>{artifact.type}</Text>
                  <Text className='badge'>{artifact.era}</Text>
                  <Text className='badge'>{artifact.excavationLocation}</Text>
                </View>
                <View style={{ color: '#64748b', fontSize: 12 }}>
                  {extractMuseumNames(artifact.collectionLocation).join('、')}
                </View>
              </View>
              <View className='itemRight'>
                {renderMarkdownLite(artifact.desc).slice(0, 3).map((n, idx) => (
                  <View key={idx} className='markdown'>
                    <Text>{n.content}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <View style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <Button size='mini' disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>上一页</Button>
          <View style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) pageNum = i + 1
              else if (currentPage <= 3) pageNum = i + 1
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = currentPage - 2 + i
              return (
                <Button key={pageNum} size='mini' type={currentPage === pageNum ? 'primary' : 'default'} onClick={() => setCurrentPage(pageNum)}>{pageNum}</Button>
              )
            })}
          </View>
          <Button size='mini' disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>下一页</Button>
        </View>
      )}

      {/* 地图 */}
      <View className='mapWrap'>
        <View className='mapHeader'>
          <View className='mapTitle'>博物馆分布</View>
          <View className='mapSub'>数字为当前筛选结果中该馆的文物数</View>
        </View>
        <Map
          style={{ width: '100%', height: '55vh' }}
          latitude={center.latitude}
          longitude={center.longitude}
          scale={scale}
          markers={markers}
          onMarkerTap={handleMarkerTap}
          showLocation={false}
        />
      </View>

      {/* 地图下方的详情面板（选中某博物馆后出现） */}
      {selectedMuseum && (
        <View className='panel'>
          <View className='panelTitle'>{selectedMuseum.name} · 共 {selectedMuseum.list.length} 件</View>
          {selectedMuseum.list.slice(0, 6).map(a => (
            <View key={a.id} className='artItem' onClick={() => setDetailItem(a)}>
              <Text style={{ fontWeight: 600 }}>{a.name}</Text>
              <Text style={{ marginLeft: 8, color: '#64748b' }}>{a.era} · {a.type}</Text>
            </View>
          ))}
          {selectedMuseum.list.length > 6 && (
            <View className='more'>还有 {selectedMuseum.list.length - 6} 件，可在上方列表中查看全部</View>
          )}
          <View style={{ marginTop: 8 }}>
            <Button size='mini' onClick={() => setSelectedMuseum(null)}>关闭面板</Button>
          </View>
        </View>
      )}

      {/* 文物详情弹层 */}
      {detailItem && (
        <View className='modalMask' onClick={() => setDetailItem(null)}>
          <View className='modal' onClick={(e) => e.stopPropagation()}>
            <View className='modalTitle'>{detailItem.name}</View>
            <View>
              <View className='modalSectionTitle'>基本信息</View>
              <View style={{ color: '#475569', fontSize: 13 }}>
                <View>类别：{detailItem.type}</View>
                <View>时代：{detailItem.era}</View>
                <View>发掘地点：{detailItem.excavationLocation}</View>
                <View>发掘时间：{detailItem.excavationTime}</View>
                <View>馆藏地点：{detailItem.collectionLocation}</View>
              </View>
              <View className='modalSectionTitle'>文物描述</View>
              <View className='markdown'>
                {renderMarkdownLite(detailItem.desc).map((n, idx) => (
                  <View key={idx}>
                    <Text>{n.content}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size='mini' onClick={() => setDetailItem(null)}>关闭</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
