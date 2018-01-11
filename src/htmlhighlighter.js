// @flow

/* eslint-disable camelcase */
import merge from 'merge';

import * as dom from './dom';
import { defaults, Css } from './consts';
import type { InputOptions, Options, Stats } from './consts';
import Ui from './ui/ui';
import TextContent from './textcontent';
import RangeHighlighter from './rangehighlighter';
import RangeUnhighlighter from './rangeunhighlighter';
import Range from './range';
import Cursor from './cursor';
import { is_obj_empty, constructFinder } from './util';

/**
 * Main class of the HTML Highlighter module, which exposes an API enabling
 * clients to control all the features supported related to highlighting and
 * text selection.
 * */
class HtmlHighlighter {
  options: Options;
  cursor: Cursor;
  ui: Ui;
  stats: Stats;
  lastId: number;
  content: TextContent;
  // FIXME: drop reliance on `any`
  transaction: Array<any>;
  queries: any;
  highlights: Array<any>;

  /** Static attribute that sets the debug state for methods that don't have access to the
   * `options` descriptor and thus can't query the `debug` attribute. */
  static debug: boolean = false;

  constructor(options: InputOptions) {
    // Merge default options
    this.options = merge({}, defaults, options);

    // Mutable properties
    this.transaction = [];
    this.queries = {};
    this.highlights = [];

    // TODO: rename attribute to something else that makes it clear it refers to the next highlight
    // id.
    this.lastId = 0;

    // TODO: refactor the following map.  In particular, the `highlight` attribute BADLY needs to
    // become a class attribute of its own since it refers to the NEXT query set id.
    this.stats = {
      queries: 0,
      total: 0,
      highlight: 0,
    };

    const { container } = options;
    if (container == null) {
      this.options.container = window.document.body;
    } else if (container instanceof HTMLElement) {
      this.options.container = container;
    }

    this.cursor = new Cursor(this);
    this.ui = new Ui(this, this.options);

    // Start by refreshing the internal document's text representation, which initialises
    // `this.content`.
    this.refresh();
    // console.info("HTML highlighter instantiated");
  }

  /**
   * Refreshes the internal representation of the text.
   *
   * Should only be invoked when the HTML structure mutates.
   */
  refresh() {
    this.content = new TextContent(this.options.container);
    if (HtmlHighlighter.debug === true) {
      this.content.assert_();
    }
  }

  /**
   * Create a query set by the name and containing one or more queries
   *
   * If the query set already exists, its contents and highlights are firs destroyed and new one
   * created.  Optionally, it is possible to specify a number of highlights to reserve for the
   * query set.
   *
   * Note that, at this point in time, only string queries and XPath representations are supported.
   *
   * @param {string} name - Name of the query set
   * @param {Array<string>} queries - Array containing individual queries to highlight
   * @param {bool} enabled - If explicitly `false`, query set is disabled; otherwise enabled
   * @param {number} [reserve] - Number of highlights to reserve for query set
   *
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  add(
    name: string,
    queries: Array<string>,
    enabled: boolean = true,
    reserve: number | null = null
  ) {
    this.transaction.push(
      function() {
        this.deferred_add_(name, queries, enabled !== false, reserve);
      }.bind(this)
    );
    return this;
  }

  /**
   * Append one or more queries to an existing query set
   *
   * If the query set doesn't yet exist, an exception is thrown. In addition, the query set
   * **must** have enough reserved space available to contain the new queries.  All queries not
   * fitting in the container are suppressed.
   *
   * @param {string} name - Name of the query set.
   * @param {string[]} queries - Array containing individual queries to highlight.
   * @param {bool} enabled - If explicitly `true`, query set is also enabled.
   *
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  append(name: string, queries: Array<string>, enabled: boolean = false) {
    this.transaction.push(
      function() {
        this.deferred_append_(name, queries, enabled !== false);
      }.bind(this)
    );
    return this;
  }

  /**
   * Remove a query set by name
   *
   * An exception is thrown if the query set does not exist.
   *
   * @param {string} name - Name of the query set to remove.
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  remove(name: string) {
    this.transaction.push(
      function() {
        this.deferred_remove_(name);
      }.bind(this)
    );
    return this;
  }

  /**
   * Enable a query set
   *
   * An exception is thrown if the query set does not exist.  If the query set is currently already
   * enabled, nothing is done.
   *
   * @param {string} name - Name of the query set to enable.
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  enable(name: string) {
    this.transaction.push(
      function() {
        this.deferred_enable_(name);
      }.bind(this)
    );
    return this;
  }

  /**
   * Disable a query set
   *
   * An exception is thrown if the query set does not exist.  If the query set is currently already
   * disabled, nothing is done.
   *
   * @param {string} name - Name of the query set to disable.
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  disable(name: string) {
    this.transaction.push(
      function() {
        this.deferred_disable_(name);
      }.bind(this)
    );
    return this;
  }

  /**
   * Remove all query sets
   *
   * Optionally, the last query set id can be reset.
   *
   * @param {boolean} reset - Last query set id is reset, if `true`.
   * @returns {HTMLHighlighter} Self instance for chaining
   */
  clear(reset: boolean) {
    this.transaction.push(
      function() {
        this.deferred_clear_(reset);
      }.bind(this)
    );
    return this;
  }

  /**
   * Apply transaction
   *
   * Note that transactions are **not** atomic.  One failure does not lead to a transaction
   * rollback or even interruption of execution; the transaction is applied regardless.
   */
  apply() {
    if (this.transaction.length === 0) {
      console.info('Nothing to apply: transaction queue empty');
      return;
    }

    this.transaction.forEach(function(action) {
      try {
        action();
      } catch (x) {
        console.error('Failed to apply action:', x);
      }
    });

    this.transaction = [];
  }

  /**
   * Set the queries that the cursor will visit when the `prev` and `next` methods are invoked
   *
   * If `null`, all queries will be visited.
   *
   * @param {Array} queries - Array containing query set names
   */
  setIterableQueries(queries: Array<string> | null = null): void {
    this.cursor.setIterableQueries(queries);
    this.ui.update(false);
  }

  /**
   * Move cursor position to the next query in the active query set
   *
   * If the cursor moves past the last query in the active query set, the active query set moves to
   * the next available one and the cursor position to its first query.  If the current query set
   * is the last in the collection and thus it is not possible to move to the next query set, the
   * first query set is made active instead, thus ensuring that the cursor always rolls over.
   */
  next(): void {
    // Do not worry about overflow; just increment it
    this.cursor.set(this.cursor.index + 1, false);
    this.ui.update(false);
  }

  /**
   * Move cursor position to the previous query in the active query set
   *
   * If the cursor moves past the first query in the active query set, the active query set moves
   * to the previous available one and the cursor position to its last query.  If the current query
   * set is the first in the collection and thus it is not possible to move to the previous query
   * set, the last query set is made active instead, thus ensuring that the cursor always rolls
   * over.
   */
  prev(): void {
    if (this.cursor.total <= 0) {
      return;
    }

    this.cursor.set((this.cursor.index < 1 ? this.cursor.total : this.cursor.index) - 1, false);
    this.ui.update(false);
  }

  /* eslint-disable complexity */
  /**
   * Return the current selected text range in the form of a `Range` object
   *
   * If there is no selected text, `null` is returned.
   *
   * @returns {Range|null} The current selected text range or `null` if it could not be
   * computed.
   */
  getSelectedRange(): Range | null {
    const sel = window.getSelection();

    if (!(sel && sel.anchorNode)) {
      return null;
    } else if (sel.anchorNode.nodeType !== 3 || sel.focusNode.nodeType !== 3) {
      console.info('Selection anchor or focus node(s) not text: ignoring');
      return null;
    }

    // Account for selections where the start and end elements are the same *and* whitespace exists
    // longer than one character.  For instance, The element `<p>a b</p>` is shown as `a b` by
    // browsers, where the whitespace is rendered collapsed.  This means that in this particular
    // case, it is not possible to simply retrieve the length of the selection's text and use that
    // as the selection's end offset as it would be invalid.  The way to avoid calculating an
    // invalid end offset is by looking at the anchor and focus (start and end) offsets.
    // Strangely, if the selection spans more than one element, one may simply use the length of
    // the selected text regardless of the occurrence of whitespace in between.
    const len =
      sel.anchorNode === sel.focusNode ? sel.focusOffset - sel.anchorOffset : sel.toString().length;
    if (len <= 0) {
      return null;
    }

    // Determine start and end indices in text offset markers array
    let start = this.content.find(sel.anchorNode);
    let end = sel.focusNode === sel.anchorNode ? start : this.content.find(sel.focusNode);

    if (start < 0 || end < 0) {
      console.error(
        'Unable to retrieve offset of selection anchor or focus node(s)',
        sel.anchorNode,
        sel.focusNode
      );
      return null;
    }

    // Create start and end range descriptors, whilst accounting for inverse selection where the
    // user selects text in a right to left orientation.
    if (start < end || (start === end && sel.anchorOffset < sel.focusOffset)) {
      start = Range.descriptorRel(this.content.at(start), sel.anchorOffset);

      if (sel.focusNode === sel.anchorNode) {
        end = merge({}, start);
        end.offset = start.offset + len - 1;
      } else {
        end = Range.descriptorRel(this.content.at(end), sel.focusOffset - 1);
      }
    } else {
      start = Range.descriptorRel(this.content.at(end), sel.focusOffset);

      if (sel.focusNode === sel.anchorNode) {
        end = merge({}, start);
        end.offset = end.offset + len - 1;
      } else {
        end = Range.descriptorRel(this.content.at(start), sel.anchorOffset - 1);
      }
    }

    return new Range(this.content, start, end);
  }
  /* eslint-enable complexity */

  /**
   * Clear the current text selection
   *
   * Only the Chrome and Firefox implementations are supported.
   */
  clearSelectedRange(): void {
    // From: http://stackoverflow.com/a/3169849/3001914
    // Note that we don't support IE at all.
    if (window.getSelection) {
      if (window.getSelection().empty) {
        // Chrome
        window.getSelection().empty();
      } else if (window.getSelection().removeAllRanges) {
        // Firefox
        window.getSelection().removeAllRanges();
      }
    }
  }

  /**
   * Return boolean indicative of whether one or more query sets are currently contained
   *
   * @returns {boolean} `false` if no query sets currently
   * contained; `true` otherwise. */
  empty(): boolean {
    // `some` returns `true` if a query containing highlights is found, so for the purpose of this
    // method, we need to reverse its value so it returns `false` in this case.
    return !Object.keys(this.queries).some(k => this.queries[k].length > 0);
  }

  /**
   * Return the last id of a query set
   *
   * @param {string} name - the name of the query set.
   * @returns {number} the last id or `-1` if query set empty.
   * */
  lastIdOf(name: string): number {
    const q = this.get_(name);
    const l = q.length;
    return l > 0 ? q.id + l - 1 : -1;
  }

  // Private interface
  // -----------------
  /**
   * Add or append queries to a query set, either enabled or disabled
   *
   * @param {string} name - the name of the query set.
   * @param {Object} q - query set descriptor.
   * @param {Array} queries - array containing the queries to add or append.
   * @param {boolean} enabled - highlights are enabled if `true`;
   * this is the default state.
   *
   * @returns {number} number of highlights added.
   * */
  add_queries_(name, q, queries, enabled) {
    const content = this.content;
    const markers = this.highlights;
    const reserve = q.reserve > 0 ? q.reserve - q.length : null;

    let count = 0;
    let csscl = null;

    if (this.options.useQueryAsClass) {
      csscl = Css.highlight + '-' + name;
    }

    let highlighter = new RangeHighlighter(q.id_highlight, q.id + q.length, enabled, csscl);

    // For each query, perform a lookup in the internal text representation and highlight each hit.
    // The global offset of each highlight is recorded in the `this.highlights´ array.  The offset
    // is used by the `Cursor´ class to compute the next/previous highlight to show.
    queries.forEach(function(i) {
      let hit, finder;

      try {
        finder = constructFinder(content, i);
      } catch (x) {
        console.error('exception: ', x);
        return;
      }

      if (hit === false) {
        console.info('Query has no hits: ', i);
        return;
      }

      // Note: insertion of global offsets to the `this.highlights` array could (should?) be done
      // in a web worker concurrently.
      while ((hit = finder.next()) !== false) {
        if (reserve !== null && count >= reserve) {
          console.error('highlight reserve exceeded');
          break;
        }

        const offset = hit.start.marker.offset + hit.start.offset;
        let mid;
        let min = 0;
        let max = markers.length - 1;

        while (min < max) {
          mid = Math.floor((min + max) / 2);

          if (markers[mid].offset < offset) {
            min = mid + 1;
          } else {
            max = mid;
          }
        }

        markers.splice(markers.length > 0 && markers[min].offset < offset ? min + 1 : min, 0, {
          query: q,
          index: count,
          offset: offset,
        });

        try {
          highlighter.do(hit);
          ++count;
        } catch (x) {
          console.error('exception: ', x);
        }
      }
    });

    q.length += count;
    if (enabled) {
      this.stats.total += count;
    }
    return count;
  }

  /**
   * Remove a query set by name
   *
   * Throws an exception if the query set does not exist.
   * @access private
   *
   * @param {string} name - The name of the query set to remove.
   */
  remove_(name) {
    const q = this.get_(name);
    const markers = this.highlights;
    let unhighlighter = new RangeUnhighlighter();

    --this.stats.queries;
    this.stats.total -= q.length;

    for (let i = q.id, l = i + q.length; i < l; ++i) {
      unhighlighter.undo(i);
    }

    for (let i = 0; i < markers.length; ) {
      if (markers[i].query === q) {
        markers.splice(i, 1);
      } else {
        ++i;
      }
    }

    delete this.queries[name];

    // TODO: Unfortunately, using the built-in `normalize` `HTMLElement` method to normalise text
    // nodes means we have to refresh the offsets of the text nodes, which may not be desirable.
    // There must be a better way.
    if (this.options.normalise) {
      this.options.container.normalize();
      this.refresh();
    }
  }

  /**
   * Safely retrieve a query set's descriptor
   *
   * Throws an exception if the query set does not exist.
   *
   * @param {string} name - The name of the query set to retrieve.
   * @returns {Object} Query set descriptor
   */
  get_(name) {
    const q = this.queries[name];
    if (q === undefined) {
      throw new Error('Query set non-existent');
    }
    return q;
  }

  assert_() {
    let k;
    let c = 0;
    let l = 0;

    Object.keys(this.queries).forEach(ki => {
      l += this.queries[ki].length;
    });

    k = 0;
    this.highlights.forEach(function(i) {
      if (i.offset < c || i.index >= i.query.length) {
        throw new Error('Invalid state: highlight out of position');
      }

      c = i.offset;
      ++k;
    });

    if (k !== l) {
      throw new Error('Invalid state: length mismatch');
    }
  }

  deferred_add_(name, queries, enabled, reserve) {
    if (!Array.isArray(queries)) {
      throw new Error('Invalid or no queries array specified');
    }

    enabled = enabled === true;
    if (typeof reserve !== 'number' || reserve < 1) {
      reserve = null;
    }

    // Remove query set if it exists
    if (name in this.queries) {
      this.deferred_remove_(name);
    }

    // TODO: rename `id_highlight` and `id` attributes below.  The former actually refers to the
    // query set id and the latter to the first highlight in the query set.  Should have been
    // refactored long ago!
    let q = (this.queries[name] = {
      name: name,
      enabled: enabled,
      id_highlight: this.stats.highlight,
      id: this.lastId,
      length: 0,
    });

    const count = this.add_queries_(name, q, queries, enabled);
    if (reserve != null) {
      if (reserve > count) {
        this.lastId = reserve;
        q.reserve = reserve;
      } else {
        console.error('Invalid or insufficient reserve specified');
        q.reserve = count;
      }
    } else {
      this.lastId += count;
    }

    // Update global statistics
    ++this.stats.queries;

    // Ensure CSS highlight class rolls over on overflow
    ++this.stats.highlight;
    if (this.stats.highlight >= this.options.maxHighlight) {
      this.stats.highlight = 0;
    }

    this.cursor.clear();
    this.ui.update();
    if (HtmlHighlighter.debug === true) {
      this.assert_();
    }
  }

  deferred_append_(name, queries, enabled) {
    if (!Array.isArray(queries)) {
      throw new Error('Invalid or no queries array specified');
    } else if (!(name in this.queries)) {
      throw new Error('Invalid or query set not yet created');
    }

    this.add_queries_(name, this.queries[name], queries, enabled === true);
    this.cursor.clear();
    this.ui.update();
    if (HtmlHighlighter.debug === true) {
      this.assert_();
    }
  }

  deferred_remove_(name) {
    this.remove_(name);
    this.cursor.clear();
    this.ui.update();
  }

  deferred_enable_(name) {
    const q = this.get_(name);
    if (q.enabled || q.id === null) {
      return;
    }

    const { disabled: cssDisabled } = Css;
    for (let i = q.id, l = i + q.length; i < l; ++i) {
      dom.removeClass(dom.getHighlightElements(i), cssDisabled);
    }

    q.enabled = true;
    this.stats.total += q.length;
    this.cursor.clear();
    this.ui.update(false);
  }

  deferred_disable_(name) {
    const q = this.get_(name);
    if (!q.enabled || q.id === null) {
      return;
    }

    const { disabled: cssDisabled } = Css;
    for (let i = q.id, l = i + q.length; i < l; ++i) {
      dom.addClass(dom.getHighlightElements(i), cssDisabled);
    }

    q.enabled = false;
    this.stats.total -= q.length;
    this.cursor.clear();
    this.ui.update(false);
  }

  deferred_clear_(reset) {
    Object.keys(this.queries).forEach(k => this.remove_(k));

    if (!is_obj_empty(this.queries)) {
      throw new Error('Query set object not empty');
    }

    if (reset) {
      this.lastId = 0;
      this.stats.highlight = 0;
    }

    this.cursor.clear();
    this.ui.update();
  }
}

export default HtmlHighlighter;
