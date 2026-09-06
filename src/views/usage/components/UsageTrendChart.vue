<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import type { UsagePoint } from '@/types/usage'
use([CanvasRenderer,LineChart,GridComponent,LegendComponent,TooltipComponent])
const props=defineProps<{points:UsagePoint[];loading?:boolean;title:string;dataDelayMinutes?:number}>()
const option=computed(()=>({
 tooltip:{trigger:'axis'},
 // 图例固定在顶部，并为横轴标签预留独立的底部空间，避免在窄卡片中相互覆盖。
 legend:{data:['输入 Token','输出 Token'],top:0,left:'center'},
 grid:{left:56,right:20,top:52,bottom:64,containLabel:true},
 xAxis:{
  type:'category',
  boundaryGap:false,
  data:props.points.map(p=>p.bucket.replace('T',' ').slice(5,16)),
  axisLabel:{margin:14,hideOverlap:true},
 },
 yAxis:{type:'value'},
 series:[{name:'输入 Token',type:'line',smooth:true,data:props.points.map(p=>p.inputTokens)},{name:'输出 Token',type:'line',smooth:true,data:props.points.map(p=>p.outputTokens)}]}))
</script>
<template><a-card :loading="loading"><template #title><div class="chart-title"><span>{{ title }}</span><small v-if="dataDelayMinutes" class="delay-hint">用量统计并非实时更新，数据可能有约 {{ dataDelayMinutes }} 分钟延迟</small></div></template><a-empty v-if="!loading&&!points.some(p=>BigInt(p.totalTokens)>0n)" description="当前范围暂无用量"/><VChart v-else class="chart" :option="option" autoresize aria-label="Token 用量趋势图"/></a-card></template>
<style scoped>.chart-title{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.delay-hint{color:#8c8c8c;font-size:12px;font-weight:400}.chart{height:300px;width:100%}</style>
