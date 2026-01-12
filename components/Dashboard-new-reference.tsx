import React from 'react';
import { Card, Badge, Button } from './UI';
import { TrendingUp, Package, ShoppingBag, Bell, ArrowUpRight, Zap, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';

const data = [
  { name: 'Mon', revenue: 400 },
  { name: 'Tue', revenue: 300 },
  { name: 'Wed', revenue: 600 },
  { name: 'Thu', revenue: 200 },
  { name: 'Fri', revenue: 900 },
  { name: 'Sat', revenue: 1200 },
  { name: 'Sun', revenue: 850 },
];

const StatCard = ({ title, value, change, icon: Icon, colorClass, delay }: any) => (
  <Card className={`relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4`} style={{ animationDelay: delay }}>
    <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 group-hover:bg-opacity-20 transition-all`}>
            <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" /> {change}
        </div>
    </div>
    <div>
      <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      <p className="text-neutral-500 text-sm font-medium mt-1">{title}</p>
    </div>
    {/* Decorative gradient glow */}
    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 blur-[50px] rounded-full group-hover:bg-violet-500/10 transition-colors"></div>
  </Card>
);

export default function Dashboard({ onViewChange }: { onViewChange: (view: string) => void }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-neutral-400 mt-1">Real-time performance metrics and alerts.</p>
        </div>
        <div className="flex gap-3">
           <Button variant="secondary" onClick={() => onViewChange('inventory')}>
             <Package className="w-4 h-4" /> Add Inventory
           </Button>
           <Button onClick={() => onViewChange('alerts')}> 
             <Zap className="w-4 h-4 fill-current" /> Quick Scan
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value="£4,250" change="+12%" icon={Target} colorClass="bg-violet-500" delay="0ms" />
        <StatCard title="Active Listings" value="124" change="+5%" icon={Package} colorClass="bg-blue-500" delay="100ms" />
        <StatCard title="Items Sold" value="48" change="+18%" icon={ShoppingBag} colorClass="bg-emerald-500" delay="200ms" />
        <StatCard title="Pending Alerts" value="8" change="Active" icon={Bell} colorClass="bg-amber-500" delay="300ms" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 min-h-[400px]">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-lg font-bold text-white">Revenue Trend</h3>
             <select className="bg-neutral-900 border border-white/10 text-neutral-400 text-xs rounded-lg px-2 py-1 outline-none text-slate-900 dark:text-white">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
             </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#737373', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#737373', fontSize: 12}} tickFormatter={(value) => `£${value}`} />
                <Tooltip 
                  cursor={{stroke: '#525252', strokeWidth: 1}}
                  contentStyle={{backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px', color: '#fff'}}
                  itemStyle={{color: '#fff'}}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold text-white">Recent Hits</h3>
               <button onClick={() => onViewChange('alerts')} className="text-violet-400 text-xs font-semibold hover:text-violet-300 flex items-center gap-1">
                 View All <ArrowUpRight className="w-3 h-3" />
               </button>
            </div>
            <div className="space-y-4 flex-1">
              {[
                { name: 'Vintage Camera', matches: 3, time: '2h ago', platform: 'eBay' },
                { name: 'Pokemon Cards (Holo)', matches: 12, time: '5h ago', platform: 'Vinted' },
                { name: 'Herman Miller Chair', matches: 1, time: '1d ago', platform: 'FB' },
              ].map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-neutral-950/50 border border-white/5 rounded-xl group hover:border-violet-500/30 transition-all cursor-pointer">
                  <div className="flex gap-3 items-center">
                    <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                    <div>
                        <div className="font-semibold text-neutral-200 text-sm group-hover:text-white">{alert.name}</div>
                        <div className="text-xs text-neutral-500 flex gap-2">
                            <span>{alert.platform}</span>
                            <span>•</span>
                            <span>{alert.time}</span>
                        </div>
                    </div>
                  </div>
                  <Badge variant="violet">{alert.matches}</Badge>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/5">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium text-neutral-400">Monthly Goal</span>
                    <span className="text-sm font-bold text-white">85%</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]" style={{ width: '85%' }}></div>
                </div>
                <p className="text-xs text-neutral-500 mt-2 text-right">£750 to reach £5,000</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
