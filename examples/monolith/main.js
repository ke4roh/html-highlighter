import $ from "jquery";
import {
  HtmlHighlighter, HtmlXpathFinder, HtmlRangeHighlighter
} from "../../src/main.js";
import "./theme.css";

/* eslint-disable global-require */
const dataFiles = [
  "viber_attacked_by_syrian_electronic_army",
  "viber_attacked_by_syrian_electronic_army-cropped",
  "ars_technica",
  "simple",
  "spaces",
  "one_paragraph",
  "one_paragraph-ampersand",
  "one_paragraph-ampersand_escaped",
  "one_paragraph-ampersand_nonexistent",
];
const data = dataFiles.map((d) => require("../../etc/data/" + d).html);

const MAX_HIGHLIGHT = 5;
const dataSources = [
  {name: "Viber hacked"},
  {name: "Viber hacked -- cropped"},
  {name: "Ars Technica"},
  {name: "Simple"},
  {name: "Spaces"},
  {name: "One paragraph"},
  {name: "One paragraph with ampersand"},
  {name: "One paragraph with escaped ampersand"},
  {name: "One paragraph with nonexistent ampersand"}
];
/* eslint-enable global-require */

var $selector, $document, $widgetSelection, $widgetMain, $search, $add;

var count = 0,
    mouseDown = 0,
    highlighter;


function init()
{
  $selector = $("#filter-data");
  $document = $("#document");
  $widgetSelection = $("#widget-selection");
  $widgetMain = $("#widget-main");
  $search = $("#search");
  $add = $("#add");

  /* Set-up sequence
   * --
   * UI */
  $search.keyup(function () {
    $add.attr("disabled", $search.val().trim().length === 0);
  });
  $search.val("").trigger("keyup").focus();

  $add.click(function () {
    var name = $search.val();
    highlighter.add(name, [name], true).apply();
    $search.select().focus();
  });

  $selector
    .change(function () { load(parseInt($selector.val())); })
    .children().remove();

  var timeout = null;
  $document.on({
    dblclick: function () { mouseDown = 0; },
    mouseup: function () {
      --mouseDown;

      /* Process text selection with a delay to ensure accurate results. */
      if(timeout !== null) window.clearTimeout(timeout);
      timeout = window.setTimeout(function () {
        timeout = null;
        if(mouseDown !== 0) return;

        var range = highlighter.getSelectedRange();
        if(range === null) {
          $widgetSelection.removeClass("enabled");
          return;
        }

        $widgetSelection.find(".offset").text(
          range.start.marker.offset
            + "(" + range.start.offset + ")"
            + ":" + range.end.marker.offset
            + "(" + range.end.offset + ")");

        var xpath = range.computeXpath();
        $widgetSelection.find(".xpath")
          .text(xpath.start.xpath + ":" + xpath.start.offset
                + " - " + xpath.end.xpath + ":" + xpath.end.offset);

        highlight_(xpath.start, xpath.end);
        highlighter.clearSelectedRange();
        $widgetSelection.addClass("enabled");
      }, 150);
    },
    mousedown: function () {
      ++mouseDown;
    }
  });

  dataSources.forEach((d, i) => {
    let $opt = $("<option/>").attr("value", i).html(d.name),
        c = data[i];

    if(typeof c !== "string" || c.length <= 0) $opt.prop("disabled", true);
    $selector.append($opt);
  });

  highlighter = new HtmlHighlighter({
    container: $document,
    widget: $widgetMain,
    maxHighlight: MAX_HIGHLIGHT
  });

  load(0);
}

function load(index)
{
  highlighter.clear().apply();
  $document.html(data[index]);
  highlighter.refresh();
  $search.focus();
}

/* TODO: the following is a nasty hack which was quickly written as a proof
 * of concept and is thus NOT meant to be used in real applications. */
function highlight_(start, end)
{
  var hit,
      finder = new HtmlXpathFinder(
        highlighter.content,
        { start: start, end: end });

  if((hit = finder.next()) !== false)
    new HtmlRangeHighlighter(count).do(hit);

  if(++count >= MAX_HIGHLIGHT)
    count = 0;
}

/* Run! */
$(init);