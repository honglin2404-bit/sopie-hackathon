const LINKS = [
  {
    label: 'SOPie Index',
    icon: '📚',
    url: 'https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung',
    styleClass:
      'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    label: 'Bảng tin SOP',
    icon: '📅',
    url: 'https://docs.google.com/spreadsheets/d/1QHnjWRPNAvKbWFRFtq5MjLNOQKj0XiKJc9MeQfDA7Wc/edit?gid=0#gid=0',
    styleClass:
      'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  {
    label: 'Theo dõi Issue',
    icon: '📋',
    url: 'https://docs.google.com/spreadsheets/d/1xUWGBiw9tBnZqrxjt4enL_oZ7LsU8QiWKhJOS5FbwrU/edit?gid=0#gid=0',
    styleClass:
      'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  {
    label: 'Báo lỗi SOP',
    icon: '🐞',
    url: 'https://forms.gle/Hbjuzu7RwdhscNfW9',
    styleClass: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300',
  },
  {
    label: 'Đề xuất SOP',
    icon: '✨',
    url: 'https://forms.gle/rXZvHgfuLHMYQ7Wn6',
    styleClass:
      'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    label: 'CSWriteLab',
    icon: '✍️',
    url: 'https://chatgpt.com/g/g-691c957c091081919a5b97e94df0bd50-cswritelab',
    styleClass:
      'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300',
  },
]

export function QuickLinks() {
  return (
    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-center md:text-left">
        Quick Buttons
      </p>
      <nav aria-label="Quick links" className="flex items-center overflow-x-auto pb-2 md:pb-0">
        <div className="flex flex-nowrap justify-between gap-3 w-full min-w-max md:min-w-0">
          {LINKS.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all shadow-sm hover:shadow-md whitespace-nowrap ${link.styleClass}`}
            >
              <span className="text-base md:text-lg" aria-hidden="true">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
