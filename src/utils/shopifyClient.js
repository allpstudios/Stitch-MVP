import { createStorefrontClient } from '@shopify/hydrogen-react';

const storeDomain = 'stitchmvp.myshopify.com';
const storefrontToken = process.env.REACT_APP_SHOPIFY_STOREFRONT_TOKEN;  // Use env variable
const adminToken = process.env.REACT_APP_SHOPIFY_ADMIN_TOKEN;  // Use env variable

const client = createStorefrontClient({
  storeDomain,
  publicStorefrontToken: storefrontToken,
  apiVersion: '2024-01'
});

// Create a fetch function for making GraphQL queries
const shopifyFetch = async (query, { variables } = {}) => {
  try {
    const url = `https://${storeDomain}/api/2024-01/graphql.json`;
    console.log('Making request to:', url);
    console.log('Query:', query);
    console.log('Variables:', JSON.stringify(variables, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontToken,
      },
      body: JSON.stringify({
        query,
        variables
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Response not OK:', response.status, text);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    console.log('Full API Response:', JSON.stringify(json, null, 2));
    
    if (json.errors) {
      console.error('GraphQL Errors:', json.errors);
    }
    
    if (json.data) {
      console.log('GraphQL Data:', JSON.stringify(json.data, null, 2));
    }

    return json;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// Create a fetch function for Admin API
const shopifyAdminFetch = async (query, { variables } = {}) => {
  try {
    const url = `https://${storeDomain}/admin/api/2024-01/graphql.json`;
    console.log('Making admin request to:', url);
    console.log('Query:', query);
    console.log('Variables:', JSON.stringify(variables, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query,
        variables
      }),
    });

    const json = await response.json();
    console.log('Admin API Response:', json);
    return json;
  } catch (error) {
    console.error('Admin fetch error:', error);
    throw error;
  }
};

export const getProducts = async () => {
  try {
    const query = `
      {
        products(first: 20) {
          edges {
            node {
              id
              title
              description
              productType
              tags
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 250) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                    quantityAvailable
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    `;

    console.log('Making API request to Shopify...');
    const response = await shopifyFetch(query);
    
    // Debug log to see the raw data
    console.log('Raw Shopify response:', JSON.stringify(response.data, null, 2));

    return response.data.products.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

export const getProduct = async (id) => {
  try {
    const query = `
      query SingleProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          productType
          tags
          options {
            name
            values
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                quantityAvailable
                availableForSale
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    `;

    console.log('Querying product with ID:', id);
    
    const response = await shopifyFetch(query, {
      variables: {
        id: id
      }
    });

    console.log('Raw API response:', response);

    if (response.errors) {
      console.error('GraphQL Errors:', response.errors);
      return null;
    }

    if (!response.data || !response.data.product) {
      console.error('No product data found');
      return null;
    }

    return response.data.product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
};

export const createCart = async (lineItems) => {
  console.log('Creating cart with line items:', lineItems);

  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          totalQuantity
          cost {
            totalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      lines: lineItems
    }
  };

  console.log('Sending mutation with variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await shopifyFetch(query, { variables });
    console.log('Cart creation response:', response);

    if (response.errors) {
      console.error('Cart creation GraphQL errors:', response.errors);
      throw new Error(response.errors[0].message);
    }

    if (!response.data?.cartCreate?.cart) {
      console.error('No cart data received:', response);
      throw new Error('Failed to create cart');
    }

    return response.data.cartCreate.cart;
  } catch (error) {
    console.error('Cart creation failed:', error);
    throw error;
  }
};

export const createCustomerAccount = async (email, password, userType, companyName) => {
  console.log('Creating customer account:', { email, userType, companyName });
  
  // First create the customer account using Storefront API
  const createMutation = `
    mutation customerCreate($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        customerUserErrors {
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      email,
      password,
      acceptsMarketing: true
    }
  };

  const createResponse = await shopifyFetch(createMutation, { variables });
  
  if (createResponse.data?.customerCreate?.customer) {
    const customerId = createResponse.data.customerCreate.customer.id;
    console.log('Customer created with ID:', customerId);
    
    try {
      // Use Admin API to set metafields and tags
      const adminMutation = `
        mutation($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              tags
              metafields(first: 5) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const adminVariables = {
        input: {
          id: customerId,
          tags: userType === 'vendor' ? ['vendor'] : ['customer'],
          metafields: [
            {
              namespace: "custom",
              key: "userType",
              value: userType || "customer",
              type: "single_line_text_field"
            }
          ]
        }
      };

      if (userType === 'vendor' && companyName) {
        adminVariables.input.metafields.push({
          namespace: "custom",
          key: "companyName",
          value: companyName,
          type: "single_line_text_field"
        });
      }

      const adminResponse = await shopifyAdminFetch(adminMutation, { variables: adminVariables });
      console.log('Admin update response:', adminResponse);

      if (adminResponse.errors) {
        console.error('Failed to set customer metadata:', adminResponse.errors);
        // Continue anyway since the account was created
      }
    } catch (error) {
      console.error('Error setting customer metadata:', error);
      // Continue anyway since the account was created
    }
  }

  return createResponse;
};

export const customerLogin = async (email, password) => {
  const mutation = `
    mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        customerUserErrors {
          code
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      email,
      password
    }
  };

  return shopifyFetch(mutation, { variables });
};

export const getCustomerData = async (accessToken) => {
  const query = `
    query getCustomer($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        id
        firstName
        lastName
        email
        phone
        userType: metafield(namespace: "custom", key: "userType") {
          value
        }
        companyName: metafield(namespace: "custom", key: "companyName") {
          value
        }
        bio: metafield(namespace: "custom", key: "bio") {
          value
        }
        address: metafield(namespace: "custom", key: "address") {
          value
        }
        coordinates: metafield(namespace: "custom", key: "coordinates") {
          value
        }
      }
    }
  `;

  const variables = {
    customerAccessToken: accessToken
  };

  return shopifyFetch(query, { variables });
};

export default {
  getProducts
}; 