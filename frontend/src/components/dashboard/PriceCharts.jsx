import { useState, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { TICKER_COLORS, TICKER_COLORS_ALPHA, CHART_DEFAULTS } from '../../utils/colors'
import { formatPrice, formatChange } from '../../utils/formatters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const TICKERS = ['NOVA', 'GRNE', 'MEDI', 'FOOD', 'LUXE', 'IRON']

export default function PriceCharts({ prices, priceChanges, priceHistory }) {
  const [activeTicker, setActiveTicker] = useState('ALL')

  const chartData = useMemo(() => {
    if (activeTicker === 'ALL') {
      const maxLen = Math.max(...Object.values(priceHistory || {}).map(h => h?.length || 0), 1)
      const labels = Array.from({ length: maxLen }, (_, i) => i)
      return {
        labels,
        datasets: TICKERS.map(ticker => ({
          label: ticker,
          data: priceHistory?.[ticker] || [],
          borderColor: TICKER_COLORS[ticker],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        })),
      }
    }

    const history = priceHistory?.[activeTicker] || []
    const labels = Array.from({ length: history.length }, (_, i) => i)
    return {
      labels,
      datasets: [{
        label: activeTicker,
        data: history,
        borderColor: TICKER_COLORS[activeTicker],
        backgroundColor: TICKER_COLORS_ALPHA[activeTicker],
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }],
    }
  }, [activeTicker, priceHistory])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: CHART_DEFAULTS.tooltipBg,
        borderColor: CHART_DEFAULTS.tooltipBorder,
        borderWidth: 1,
        titleFont: { family: "'JetBrains Mono'" },
        bodyFont: { family: "'JetBrains Mono'" },
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        grid: { color: CHART_DEFAULTS.gridColor },
        ticks: {
          color: CHART_DEFAULTS.textColor,
          font: { family: "'JetBrains Mono'", size: 10 },
          callback: v => `$${v}`,
        },
      },
    },
  }

  return (
    <div className="price-charts panel">
      <div className="chart-tabs">
        <button
          className={`chart-tab ${activeTicker === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTicker('ALL')}
        >
          ALL
        </button>
        {TICKERS.map(ticker => {
          const change = priceChanges?.[ticker] || 0
          return (
            <button
              key={ticker}
              className={`chart-tab ${activeTicker === ticker ? 'active' : ''}`}
              style={{
                '--tab-color': TICKER_COLORS[ticker],
                borderColor: activeTicker === ticker ? TICKER_COLORS[ticker] : undefined,
              }}
              onClick={() => setActiveTicker(ticker)}
            >
              <span className="tab-ticker">{ticker}</span>
              <span className={`tab-price mono ${change >= 0 ? 'price-up' : 'price-down'}`}>
                {formatPrice(prices?.[ticker] || 0)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>

      {activeTicker !== 'ALL' && (
        <div className="chart-hero-price">
          <span className="hero-ticker" style={{ color: TICKER_COLORS[activeTicker] }}>
            {activeTicker}
          </span>
          <span className="hero-price mono">{formatPrice(prices?.[activeTicker] || 0)}</span>
          <span className={`hero-change mono ${(priceChanges?.[activeTicker] || 0) >= 0 ? 'price-up' : 'price-down'}`}>
            {(priceChanges?.[activeTicker] || 0) >= 0 ? '▲' : '▼'} {formatChange(priceChanges?.[activeTicker] || 0)}
          </span>
        </div>
      )}

      <style>{`
        .price-charts {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chart-tabs {
          display: flex;
          gap: 2px;
          padding: 8px;
          border-bottom: 1px solid var(--border-subtle);
          overflow-x: auto;
        }
        .chart-tab {
          padding: 6px 10px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          white-space: nowrap;
          transition: all 0.2s var(--ease-snappy);
        }
        .chart-tab:hover {
          background: var(--bg-tertiary);
        }
        .chart-tab.active {
          background: var(--bg-tertiary);
          border-color: var(--tab-color, var(--accent-cyan));
          color: var(--text-primary);
        }
        .tab-ticker { font-weight: 700; }
        .tab-price { font-size: 0.65rem; }
        .chart-container {
          flex: 1;
          padding: 8px;
          min-height: 0;
        }
        .chart-hero-price {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 8px 16px 12px;
        }
        .hero-ticker {
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 0.9rem;
        }
        .hero-price {
          font-size: 2rem;
          font-weight: 700;
        }
        .hero-change {
          font-size: 1rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
