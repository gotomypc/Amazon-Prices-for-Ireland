// ==UserScript==
// @name          Amazon Prices for Ireland
// @namespace     http://www.17od.com/amazon-for-ireland
// @description   Show prices on amazon.co.uk in euros with the Irish VAT rate applied
// @include       http://www.amazon.co.uk/*
// @include       https://www.amazon.co.uk/*
// @include       http://amazon.co.uk/*
// @include       https://amazon.co.uk/*
// ==/UserScript==

(function() {

    var gbpToEurRate = GM_getValue("gbp_to_eur_rate");
    var dateRateLastRetrieved = GM_getValue("date_rate_last_retrieved");
    var todayDate = new Date();
    var todayAsString = todayDate.getDate() + "/" + todayDate.getMonth() + "/" + todayDate.getFullYear();

    var standardIrishVATRate = 0.215;

    function retrieveRate(callback) {
        GM_xmlhttpRequest({
                method: "GET",
                url: "http://download.finance.yahoo.com/d/quotes.csv?s=GBPEUR=X&f=l1&e=.csv",
                onload: function(responseDetails) {
                    var rate = parseFloat(responseDetails.responseText.replace(/[\r\n]/g, ""));
                    GM_log("retrieved the rate " + rate);
                    // The amount added to rate below is to account for a
                    // difference between the GBP to EURO rate retrieved from 
                    // Yahoo and the one Amazon will use. It's not exact but
                    // reflects an average markup Amazon applies to the open 
                    // market rate
                    rate = rate + 0.04;
                    gbpToEurRate = rate;
                    GM_setValue("gbp_to_eur_rate", rate.toString());
                    GM_setValue("date_rate_last_retrieved", todayAsString);
                    callback();
                },
                onerror: function(responseDetails) {
                    alert("Error fetching currency data for " + coin);
                }
        });
    }

    function getNode(xpath) {
      var xpath_result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);    
      return xpath_result.singleNodeValue;
    }

    // Return a string containing the Irish price
    function calculateIrishPrice(gbpPrice) {

        var irishVatRate = standardIrishVATRate;

        // Books don't have VAT
        if (isBook()) {
            irishVatRate = 0;
        }

        GM_log("Determined irish VAT rate to be " + irishVatRate);

        var gbpExVATPrice = gbpPrice * 0.85; // UK VAT rate is 15%
        var euroPrice = gbpExVATPrice * gbpToEurRate;
        // Irish VAT rate is 21.5%. Amazon add on about .03% for something else.
        // Waste management charge perhaps (http://www.weeeregister.ie)?
        var irishPrice = euroPrice * ((1 + irishVatRate) + 0.03);

        return irishPrice.toFixed(2);
    }

    // Determine if the product listed on the current page is a book
    // This is done by searching for a node with the text "ISBN:"
    function isBook() {
        var elems = document.getElementsByTagName("b");
        var j = 0;
        var k = 0;
        var isBook = false;

        while (!isBook && j < elems.length) {
            var price = elems[j];
            k = 0;
            while (!isBook && k < price.childNodes.length) {
                var currNode = price.childNodes[k];
                if (currNode.nodeType == 3) {
                    if (currNode.nodeValue == "ISBN-10:") {
                        isBook = true;
                    }
                }
                k++;
            }
            j++;
        }

        return isBook;
    }

    function updatePageWithIrishPrice() {
        // Find the GBP price
        var price_node = getNode("//b[@class='priceLarge']");
        if (price_node != null) {
            // strip off the pound sign and comma
	        var priceInGBP = parseFloat(price_node.innerHTML.replace(/\u00A3/, "").replace(/,/, ""));
	        GM_log("priceInGBP=" + priceInGBP + ")");

	        // Get the ex-VAT price, convert to EUR and add on the irish VAT
	        var irishPrice = calculateIrishPrice(priceInGBP);
	        GM_log("irishPrice=" + irishPrice + ")");

	        // Get the node under which we're going to put a new TR with the irish price
	        var pricingTBodyNode = getNode("//div[@id='priceBlock']/table/tbody");

	        // Get the TR containing the GBP price. We're going to clone this node
	        var ukPriceNode = getNode("//div[@id='priceBlock']/table/tbody/tr[2]");

	        // Create a new TR, populate it with the Irish price and add it to the TBODY
	        var irishPriceNode = ukPriceNode.cloneNode(true);
	        irishPriceNode.cells[0].innerHTML = "Irish Price:";
	        irishPriceNode.cells[1].innerHTML = "<b class=\"priceLarge\">\u20ac" + irishPrice + "</b> (approximately)";
	        pricingTBodyNode.appendChild(irishPriceNode);
	    }
    }

    // If we have no rate or the rate hasn't been retrieved today then retrieve
    // the latest rate
    if (gbpToEurRate === undefined || dateRateLastRetrieved !== todayAsString) {
        GM_log("need to retrieve a new rate");
        retrieveRate(updatePageWithIrishPrice);
    } else {
        updatePageWithIrishPrice();
    }

})();

