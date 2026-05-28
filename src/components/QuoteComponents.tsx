import { RefreshCcw, Star } from "lucide-react";
import type { Quote } from "../types";

export function DailyQuoteCard({
  quote,
  favorite,
  onRefresh,
  onToggleFavorite,
}: {
  quote: Quote;
  favorite: boolean;
  onRefresh: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="panel quote-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Daily quote</p>
          <h3>Wisdom for the day</h3>
        </div>
        <span className="quote-category">{quote.category}</span>
      </div>
      <blockquote>“{quote.text}”</blockquote>
      <p className="quote-author">{quote.author}</p>
      <p className="panel-copy">{quote.context}</p>
      <div className="quote-actions">
        <button className="secondary-button" type="button" onClick={onRefresh}>
          <RefreshCcw size={17} />
          Refresh quote
        </button>
        <button className={favorite ? "primary-button" : "secondary-button"} type="button" onClick={onToggleFavorite}>
          <Star size={17} />
          {favorite ? "Favorited" : "Favorite quote"}
        </button>
      </div>
    </article>
  );
}
