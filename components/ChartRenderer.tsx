'use client'

import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, ScatterChart, Scatter, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { ChartConfig } from '@/lib/chart-service'

interface ChartRendererProps {
  config: ChartConfig
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb347']

export default function ChartRenderer({ config }: ChartRendererProps) {
  const renderChart = () => {
    const commonProps = {
      data: config.data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    }

    switch (config.type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={config.xAxis?.dataKey} 
              label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -10 }}
              stroke="#666"
            />
            <YAxis 
              label={{ value: config.yAxis?.label, angle: -90, position: 'insideLeft' }}
              stroke="#666"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            {config.dataKeys.map((dk, idx) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name}
                stroke={dk.color || COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={config.xAxis?.dataKey} 
              label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -10 }}
              stroke="#666"
            />
            <YAxis 
              label={{ value: config.yAxis?.label, angle: -90, position: 'insideLeft' }}
              stroke="#666"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            {config.dataKeys.map((dk, idx) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                name={dk.name}
                fill={dk.color || COLORS[idx % COLORS.length]}
                radius={[8, 8, 0, 0]}
              />
            ))}
          </BarChart>
        )

      case 'pie':
        const pieData = config.data.map((item, idx) => ({
          ...item,
          fill: COLORS[idx % COLORS.length]
        }))
        
        return (
          <PieChart>
            <Pie
              data={pieData}
              dataKey={config.dataKeys[0]?.key}
              nameKey={config.xAxis?.dataKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={(entry) => entry[config.xAxis?.dataKey || 'name']}
              labelLine={true}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
          </PieChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={config.xAxis?.dataKey} 
              label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -10 }}
              stroke="#666"
            />
            <YAxis 
              label={{ value: config.yAxis?.label, angle: -90, position: 'insideLeft' }}
              stroke="#666"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            {config.dataKeys.map((dk, idx) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name}
                stroke={dk.color || COLORS[idx % COLORS.length]}
                fill={dk.color || COLORS[idx % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        )

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={config.xAxis?.dataKey} 
              label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -10 }}
              stroke="#666"
            />
            <YAxis 
              dataKey={config.dataKeys[0]?.key}
              label={{ value: config.yAxis?.label, angle: -90, position: 'insideLeft' }}
              stroke="#666"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Legend />
            {config.dataKeys.map((dk, idx) => (
              <Scatter
                key={dk.key}
                name={dk.name}
                data={config.data}
                fill={dk.color || COLORS[idx % COLORS.length]}
              />
            ))}
          </ScatterChart>
        )

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={config.xAxis?.dataKey} 
              label={{ value: config.xAxis?.label, position: 'insideBottom', offset: -10 }}
              stroke="#666"
            />
            <YAxis 
              label={{ value: config.yAxis?.label, angle: -90, position: 'insideLeft' }}
              stroke="#666"
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            />
            <Legend />
            {config.dataKeys.map((dk, idx) => {
              // Alternate between Bar and Line for composed charts
              if (idx % 2 === 0) {
                return (
                  <Bar
                    key={dk.key}
                    dataKey={dk.key}
                    name={dk.name}
                    fill={dk.color || COLORS[idx % COLORS.length]}
                    radius={[8, 8, 0, 0]}
                  />
                )
              } else {
                return (
                  <Line
                    key={dk.key}
                    type="monotone"
                    dataKey={dk.key}
                    name={dk.name}
                    stroke={dk.color || COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                  />
                )
              }
            })}
          </ComposedChart>
        )

      default:
        return <div className="text-center text-black/60">Unsupported chart type</div>
    }
  }

  return (
    <div className="bg-white rounded-lg border border-black/10 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-black">{config.title}</h3>
        {config.description && (
          <p className="text-sm text-black/60 mt-1">{config.description}</p>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}
