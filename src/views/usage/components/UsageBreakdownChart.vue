<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { UsageBreakdownItem, UsageBreakdownOrder } from '@/types/usage'
use([CanvasRenderer,BarChart,GridComponent,TooltipComponent])
const props=defineProps<{items:UsageBreakdownItem[];orderBy:UsageBreakdownOrder;loading?:boolean}>()
const metricLabel=computed(()=>({totalTokens:'总 Token',estimatedCostFen:'预估费用（分）',requestCount:'请求数'}[props.orderBy]))
const value=(item:UsageBreakdownItem)=>item.metrics[props.orderBy]
const option=computed(()=>({
 grid:{left:130,right:36,top:20,bottom:36,containLabel:false},
 tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:(values:Array<{name:string;value:number;dataIndex:number}>)=>{const v=values[0];return v?`${v.name}<br/>${metricLabel.value}：${value(props.items[v.dataIndex])}`:''}},
 xAxis:{type:'value',name:metricLabel.value,nameLocation:'middle',nameGap:28},
 yAxis:{type:'category',inverse:true,data:props.items.map(item=>item.label),axisLabel:{width:112,overflow:'truncate'}},
 series:[{type:'bar',data:props.items.map(item=>Number(value(item))),itemStyle:{color:'#1677ff',borderRadius:[0,4,4,0]}}],
}))
</script>
<template>
 <a-card title="维度排行" :loading="loading">
  <template #extra><slot name="extra"/></template>
  <a-empty v-if="!loading&&!items.length" description="当前范围暂无排行数据"/>
  <VChart v-else class="chart" :option="option" autoresize aria-label="用量维度排行榜"/>
 </a-card>
</template>

<style scoped>
.chart {
 width: 100%;
 height: 360px;
}
</style>
