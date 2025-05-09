          <div className="order-quantities">
            <h3>Order Quantities</h3>
            <div className="quantity-section">
              <div className="total-quantity">
                <label>Total Quantity Required</label>
                <input
                  type="number"
                  value={totalQuantity}
                  onChange={(e) => setTotalQuantity(e.target.value)}
                  placeholder="Enter total quantity needed"
                  required
                />
              </div>
            </div>

            <div className="size-breakdown">
              <label>Size Breakdown (if applicable)</label>
              <div className="size-grid">
                {SIZES.map((size) => (
                  <div key={size} className="size-input">
                    <label>{size}</label>
                    <input
                      type="number"
                      placeholder="0"
                      onChange={(e) => handleQuantityChange(0, size, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div> 